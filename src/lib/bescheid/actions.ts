'use server'

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { env } from '@/env'
import { validierePdf } from '@/lib/admin/pdf-upload'
import { validiereUploadDatei } from '@/lib/admin/datei-upload'
import { wechsleStatusMitProtokoll } from '@/lib/bescheid/status-helfer'
import { holeAngebot } from '@/lib/db/repositories/angebote'
import {
  fuegeBelegHinzu,
  holeBescheidBundle,
  holeVerwendungsnachweis,
  listeVnwBelege,
  loescheBeleg,
  markiereVnwEingereicht,
  referenziereBescheidDokument,
  speichereBescheidDaten,
  speichereSachbericht,
  speichereZeitraumUndFrist,
  stelleVnwSicher,
  vermerkeBescheidUpload,
} from '@/lib/db/repositories/bescheid'
import { audit } from '@/lib/db/repositories/journey'
import { supabaseServer } from '@/lib/db/server'
import { sendeBescheidBestaetigungAnKunden, sendeBescheidHinweisAnAdmins } from '@/lib/email/notify'
import { loggeFehler } from '@/lib/fehler'
import { analysiereBescheid, type BescheidAnalyse } from '@/lib/gemini/bescheid-analyse'
import { ladeDokumentHoch } from '@/lib/storage/blob'
import { holeSession } from '@/lib/auth/guards'

/**
 * Server Actions der Stationen „Zuwendungsbescheid" und
 * „Verwendungsnachweis" (Migration 25). Autorisierung JE Action über
 * fordereVorgangZugriff: Admin-Rollen (admin/eskalator/vertrieb) oder
 * Kunde mit angebot_zugriffe-Zuordnung – alles andere wird abgelehnt.
 */

export type BescheidActionErgebnis<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { hinweis?: string } : { hinweis?: string } & T))
  | { ok: false; fehler: string }

/** Volle Session-Struktur ({ session, user }) – abgeleitet vom Guard. */
type Vollsitz = NonNullable<Awaited<ReturnType<typeof holeSession>>>
type VorgangsSession = { session: Vollsitz; rolle: 'admin' | 'kunde'; angebotId: string }

const ADMIN_ROLLEN = new Set(['admin', 'eskalator', 'vertrieb'])

/**
 * Gemeinsamer Zugriffs-Guard: prüft Session + Vorgangsbezug.
 * Admin-Rollen dürfen alles; Kunden nur ihre zugeordneten Vorgänge.
 * Liefert null bei fehlendem Zugriff (Aufrufer meldet den Fehler).
 */
async function fordereVorgangZugriff(angebotId: string): Promise<VorgangsSession | null> {
  const session = await holeSession()
  if (!session?.user) return null
  const rolle = ADMIN_ROLLEN.has(String((session.user as { role?: string }).role)) ? 'admin' : 'kunde'
  if (rolle === 'admin') return { session, rolle, angebotId }
  const { data: zugriff } = await supabaseServer()
    .from('angebot_zugriffe')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('angebot_id', angebotId)
    .maybeSingle()
  return zugriff ? { session, rolle: 'kunde', angebotId } : null
}

const DATUM = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format JJJJ-MM-TT vorliegen.')
  .optional()
  .or(z.literal('').transform(() => undefined))

const bescheidDatenSchema = z.object({
  aktenzeichen: z.string().trim().max(120).optional(),
  bewilligt_am: DATUM,
  foerderquote_pct: z.coerce.number().int().refine((v) => [25, 35, 45].includes(v), 'Förderquote muss 25, 35 oder 45 sein.').optional(),
  foerdersumme_eur: z.coerce.number().min(0).optional(),
  durchfuehrung_von: DATUM,
  durchfuehrung_bis: DATUM,
  vnw_frist_am: DATUM,
  auflagen: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  notiz: z.string().trim().max(4000).optional(),
})

// ---------- 1 · Bescheid-Upload (Drag & Drop, Kunde UND Admin) ----------

/**
 * Lädt den Zuwendungsbescheid hoch: PDF-Validierung (Magic-Bytes) →
 * privater Blob → dokumente(typ 'bescheid', letzter Upload gewinnt) →
 * Gemini-OCR als ROHBEFUND (best effort) → bescheide-Zeile → VNW lazy
 * anlegen (aktiviert die neuen Stationen). KEIN Statuswechsel – der folgt
 * mit der menschlichen Bestätigung (Human-in-the-loop).
 * Anti-Missbrauch: max. 10 Bescheid-Blobs je Angebotsnummer.
 */
export async function ladeBescheidHoch(
  angebotId: string,
  formData: FormData,
): Promise<BescheidActionErgebnis<{ analyse: BescheidAnalyse | null }>> {
  const zugriff = await fordereVorgangZugriff(angebotId)
  if (!zugriff) return { ok: false, fehler: 'Kein Zugriff auf diesen Vorgang.' }
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }

  const geprueft = await validierePdf(formData)
  if ('fehler' in geprueft) return { ok: false, fehler: geprueft.fehler }

  try {
    const url = await ladeDokumentHoch(`bescheid/${angebot.angebot_nr}.pdf`, geprueft.bytes)
    if (!url) {
      return { ok: false, fehler: 'Der Upload konnte nicht gespeichert werden (Storage-Fehler). Bitte versuchen Sie es erneut oder kontaktieren Sie Ihren MABE-Ansprechpartner.' }
    }

    // OCR (best effort): Fehler blockieren den Upload nicht – die Werte
    // sind dann manuell zu erfassen; der Grund wird zurückgegeben.
    let analyse: BescheidAnalyse | null = null
    let ocrGrund: string | null = null
    if (env.GEMINI_API_KEY) {
      const res = await analysiereBescheid(geprueft.bytes)
      if (res.ok) analyse = res.analyse
      else ocrGrund = res.fehler
    } else {
      ocrGrund = 'GEMINI_API_KEY ist nicht gesetzt – Daten bitte manuell erfassen.'
    }

    await referenziereBescheidDokument(angebotId, url)
    await vermerkeBescheidUpload(angebotId, zugriff.session.user.id, analyse as unknown as Record<string, unknown> | null)
    // Aktivierung: VNW-Zeile anlegen + Frist-Snapshot aus der OCR.
    await stelleVnwSicher(angebotId, analyse?.vnw_frist_am ?? null)

    await audit(angebotId, `${zugriff.rolle}:${zugriff.session.user.id}`, 'bescheid_hochgeladen', {
      datei: geprueft.name,
      ocr_ok: !!analyse,
      ocr_grund: ocrGrund,
    })
    // Fristen laufen ab jetzt – Team informieren (best effort, wie alle Mails).
    const hinweis = await sendeBescheidHinweisAnAdmins({
      kundeFirma: angebot.kunde_firma,
      angebotNr: angebot.angebot_nr,
      fristAm: analyse?.vnw_frist_am ?? null,
      hochgeladenVon: `${zugriff.rolle === 'admin' ? 'Team' : 'Kunde'} (${zugriff.session.user.email ?? zugriff.session.user.id})`,
    })
    await audit(angebotId, 'system', 'bescheid_email_admins', {
      gesendet: hinweis.ok,
      grund: hinweis.grund ?? null,
    })

    // Kunden-Bestaetigung (best effort): "Bescheid ist eingegangen" mit
    // gelesener Frist und Foerdersumme, erklaert den VNW-Prozess.
    const kundenMail = await sendeBescheidBestaetigungAnKunden({
      an: angebot.kunde_email,
      kundeFirma: angebot.kunde_firma,
      angebotNr: angebot.angebot_nr,
      fristAm: analyse?.vnw_frist_am ?? null,
      foerdersummeEur: analyse?.foerdersumme_eur ?? null,
    })
    await audit(angebotId, 'system', 'bescheid_email_kunde', {
      gesendet: kundenMail.ok,
      grund: kundenMail.grund ?? null,
    })

    revalidatePath(`/konto/vorgang/${angebotId}`)
    revalidatePath('/admin/kunden')
    return {
      ok: true,
      hinweis: analyse
        ? 'Bescheid hochgeladen – gelesene Daten bitte prüfen und bestätigen.'
        : `Bescheid hochgeladen. OCR nicht möglich (${ocrGrund ?? 'unbekannt'}) – Daten bitte manuell erfassen.`,
      analyse,
    }
  } catch (e) {
    loggeFehler('bescheid', e, { route: 'upload', angebotId })
    return { ok: false, fehler: e instanceof Error ? e.message : 'Upload fehlgeschlagen.' }
  }
}

// ---------- 2 · Bescheid-Daten bestätigen (aktiviert 'bewilligt') ----------

/**
 * Schreibt die geprüften Bescheid-Daten und setzt den Vorgang auf
 * 'bewilligt' (erlaubte Übergänge: eingereicht/abgeschlossen → bewilligt;
 * ist der Zustand schon weiter, bleibt er unangetastet).
 */
export async function bestaetigeBescheidDaten(
  angebotId: string,
  eingabe: z.infer<typeof bescheidDatenSchema>,
): Promise<BescheidActionErgebnis> {
  const zugriff = await fordereVorgangZugriff(angebotId)
  if (!zugriff) return { ok: false, fehler: 'Kein Zugriff auf diesen Vorgang.' }

  const res = bescheidDatenSchema.safeParse(eingabe)
  if (!res.success) return { ok: false, fehler: res.error.issues[0]?.message ?? 'Eingaben unvollständig.' }
  const d = res.data
  if (d.durchfuehrung_von && d.durchfuehrung_bis && d.durchfuehrung_von > d.durchfuehrung_bis) {
    return { ok: false, fehler: 'Beginn des Durchführungszeitraums liegt nach dem Ende.' }
  }

  const bundle = await holeBescheidBundle(angebotId)
  if (!bundle?.bescheid) {
    return { ok: false, fehler: 'Bitte zuerst den Zuwendungsbescheid hochladen.' }
  }

  try {
    await speichereBescheidDaten(angebotId, zugriff.session.user.id, {
      aktenzeichen: d.aktenzeichen || null,
      bewilligt_am: d.bewilligt_am ?? null,
      foerderquote_pct: (d.foerderquote_pct ?? null) as 25 | 35 | 45 | null,
      foerdersumme_eur: d.foerdersumme_eur ?? null,
      durchfuehrung_von: d.durchfuehrung_von ?? null,
      durchfuehrung_bis: d.durchfuehrung_bis ?? null,
      vnw_frist_am: d.vnw_frist_am ?? null,
      auflagen: d.auflagen ?? [],
      notiz: d.notiz || null,
    })
    // Frist-Snapshot am VNW nachziehen (falls noch offen).
    await stelleVnwSicher(angebotId, d.vnw_frist_am ?? null)

    // Statuswechsel 'bewilligt' – mit Protokoll (Revision + Audit).
    const wechsel = await wechsleStatusMitProtokoll(angebotId, 'bewilligt', zugriff)
    await audit(angebotId, `${zugriff.rolle}:${zugriff.session.user.id}`, 'bescheid_bestaetigt', {
      aktenzeichen: d.aktenzeichen ?? null,
      vnw_frist_am: d.vnw_frist_am ?? null,
      statuswechsel: wechsel,
    })
    revalidatePath(`/konto/vorgang/${angebotId}`)
    revalidatePath('/admin/kunden')
    return { ok: true, hinweis: 'Bescheid-Daten bestätigt – Durchführungszeitraum und Verwendungsnachweis sind aktiv.' }
  } catch (e) {
    loggeFehler('bescheid', e, { route: 'bestaetigen', angebotId })
    return { ok: false, fehler: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.' }
  }
}

// ---------- 3 · Durchführungszeitraum & Frist (nachträglich änderbar) ----------

const zeitraumSchema = z.object({
  durchfuehrung_von: DATUM,
  durchfuehrung_bis: DATUM,
  vnw_frist_am: DATUM,
})

export async function speichereZeitraum(
  angebotId: string,
  eingabe: z.infer<typeof zeitraumSchema>,
): Promise<BescheidActionErgebnis> {
  const zugriff = await fordereVorgangZugriff(angebotId)
  if (!zugriff) return { ok: false, fehler: 'Kein Zugriff auf diesen Vorgang.' }
  const res = zeitraumSchema.safeParse(eingabe)
  if (!res.success) return { ok: false, fehler: res.error.issues[0]?.message ?? 'Eingaben unvollständig.' }
  const { durchfuehrung_von, durchfuehrung_bis, vnw_frist_am } = res.data
  if (durchfuehrung_von && durchfuehrung_bis && durchfuehrung_von > durchfuehrung_bis) {
    return { ok: false, fehler: 'Beginn des Durchführungszeitraums liegt nach dem Ende.' }
  }
  const bundle = await holeBescheidBundle(angebotId)
  if (!bundle?.bescheid) return { ok: false, fehler: 'Kein Bescheid hinterlegt – Zeitraum nicht erfassbar.' }

  try {
    await speichereZeitraumUndFrist(angebotId, durchfuehrung_von ?? null, durchfuehrung_bis ?? null, vnw_frist_am ?? null)
    await audit(angebotId, `${zugriff.rolle}:${zugriff.session.user.id}`, 'zeitraum_gespeichert', {
      von: durchfuehrung_von ?? null,
      bis: durchfuehrung_bis ?? null,
      vnw_frist_am: vnw_frist_am ?? null,
    })
    revalidatePath(`/konto/vorgang/${angebotId}`)
    revalidatePath('/admin/kunden')
    return { ok: true, hinweis: 'Durchführungszeitraum und Vorlagefrist gespeichert.' }
  } catch (e) {
    loggeFehler('bescheid', e, { route: 'zeitraum', angebotId })
    return { ok: false, fehler: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.' }
  }
}

// ---------- 4 · VNW-Belege (Drag & Drop je Beleg) ----------

const belegSchema = z.object({
  kategorie: z.enum(['rechnung', 'zahlungsnachweis', 'sonstiges']),
  betrag_eur: z.coerce.number().min(0).optional(),
})

/**
 * Lädt einen VNW-Beleg hoch (PDF/PNG/JPG, Magic-Bytes): dokumente(typ
 * 'vnw_beleg') + Metadaten-Zeile. Voraussetzung: Bescheid existiert und
 * der Verwendungsnachweis ist noch nicht eingereicht.
 */
export async function ladeBelegHoch(
  angebotId: string,
  formData: FormData,
  eingabe: z.infer<typeof belegSchema>,
): Promise<BescheidActionErgebnis> {
  const zugriff = await fordereVorgangZugriff(angebotId)
  if (!zugriff) return { ok: false, fehler: 'Kein Zugriff auf diesen Vorgang.' }

  const bundle = await holeBescheidBundle(angebotId)
  if (!bundle?.bescheid) return { ok: false, fehler: 'Zuerst den Zuwendungsbescheid hochladen.' }
  const vnw = await holeVerwendungsnachweis(angebotId)
  if (vnw?.status === 'eingereicht') return { ok: false, fehler: 'Verwendungsnachweis ist bereits eingereicht.' }

  const res = belegSchema.safeParse(eingabe)
  if (!res.success) return { ok: false, fehler: res.error.issues[0]?.message ?? 'Eingaben unvollständig.' }

  const datei = await validiereUploadDatei(formData)
  if ('fehler' in datei) return { ok: false, fehler: datei.fehler }

  try {
    const pfad = `vnw-belege/${angebotId}/${Date.now()}-${datei.name}`
    const url = await ladeDokumentHoch(pfad, datei.bytes, datei.contentType)
    if (!url) {
      return { ok: false, fehler: 'Der Upload konnte nicht gespeichert werden (Storage-Fehler). Bitte versuchen Sie es erneut oder kontaktieren Sie Ihren MABE-Ansprechpartner.' }
    }
    const db = supabaseServer()
    const { data: dokument, error: eDoc } = await db
      .from('dokumente')
      .insert({ angebot_id: angebotId, typ: 'vnw_beleg', storage_path: url })
      .select('id')
      .single()
    if (eDoc || !dokument) throw new Error(`Dokumente: ${eDoc?.message ?? 'unbekannt'}`)

    await fuegeBelegHinzu(angebotId, dokument.id as string, res.data.kategorie, res.data.betrag_eur ?? null)
    await stelleVnwSicher(angebotId, null)
    // Erster Beleg: VNW gilt als in Bearbeitung.
    await db.from('verwendungsnachweise').update({ status: 'in_bearbeitung' }).eq('angebot_id', angebotId).eq('status', 'offen')
    await audit(angebotId, `${zugriff.rolle}:${zugriff.session.user.id}`, 'vnw_beleg_hochgeladen', {
      datei: datei.name,
      kategorie: res.data.kategorie,
    })
    revalidatePath(`/konto/vorgang/${angebotId}/nachweis`)
    return { ok: true, hinweis: `„${datei.name}“ wurde als Beleg hinzugefügt.` }
  } catch (e) {
    loggeFehler('bescheid', e, { route: 'beleg_upload', angebotId })
    return { ok: false, fehler: e instanceof Error ? e.message : 'Upload fehlgeschlagen.' }
  }
}

/** Entfernt einen Beleg (solange der Verwendungsnachweis offen ist). */
export async function entferneBeleg(angebotId: string, belegId: string): Promise<BescheidActionErgebnis> {
  const zugriff = await fordereVorgangZugriff(angebotId)
  if (!zugriff) return { ok: false, fehler: 'Kein Zugriff auf diesen Vorgang.' }
  const vnw = await holeVerwendungsnachweis(angebotId)
  if (vnw?.status === 'eingereicht') return { ok: false, fehler: 'Verwendungsnachweis ist bereits eingereicht.' }
  try {
    await loescheBeleg(angebotId, belegId)
    await audit(angebotId, `${zugriff.rolle}:${zugriff.session.user.id}`, 'vnw_beleg_entfernt', { belegId })
    revalidatePath(`/konto/vorgang/${angebotId}/nachweis`)
    return { ok: true, hinweis: 'Beleg entfernt.' }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Löschen fehlgeschlagen.' }
  }
}

// ---------- 5 · Sachbericht & Einreichung ----------

const sachberichtSchema = z.string().trim().max(8000, 'Der Sachbericht darf höchstens 8000 Zeichen haben.')

export async function speichereVnwSachbericht(angebotId: string, text: string): Promise<BescheidActionErgebnis> {
  const zugriff = await fordereVorgangZugriff(angebotId)
  if (!zugriff) return { ok: false, fehler: 'Kein Zugriff auf diesen Vorgang.' }
  const bundle = await holeBescheidBundle(angebotId)
  if (!bundle?.bescheid) return { ok: false, fehler: 'Zuerst den Zuwendungsbescheid hochladen.' }
  const vnw = await holeVerwendungsnachweis(angebotId)
  if (vnw?.status === 'eingereicht') return { ok: false, fehler: 'Verwendungsnachweis ist bereits eingereicht.' }
  const res = sachberichtSchema.safeParse(text)
  if (!res.success) return { ok: false, fehler: res.error.issues[0]?.message ?? 'Eingabe ungültig.' }
  try {
    await stelleVnwSicher(angebotId, null)
    await speichereSachbericht(angebotId, res.data || null)
    await audit(angebotId, `${zugriff.rolle}:${zugriff.session.user.id}`, 'vnw_sachbericht_gespeichert', {})
    revalidatePath(`/konto/vorgang/${angebotId}/nachweis`)
    return { ok: true, hinweis: 'Sachbericht gespeichert.' }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.' }
  }
}

/**
 * Reich den Verwendungsnachweis ein: setzt VNW auf 'eingereicht' (Zeitpunkt,
 * Wer) und den Vorgang auf 'vnw_eingereicht'. Gates (Domain): Bescheid
 * bestätigt + mindestens ein Beleg – fehlende Bausteine werden gemeldet.
 */
export async function reicheVerwendungsnachweisEin(angebotId: string): Promise<BescheidActionErgebnis> {
  const zugriff = await fordereVorgangZugriff(angebotId)
  if (!zugriff) return { ok: false, fehler: 'Kein Zugriff auf diesen Vorgang.' }

  const [bundle, vnw, belege] = await Promise.all([
    holeBescheidBundle(angebotId),
    holeVerwendungsnachweis(angebotId),
    listeVnwBelege(angebotId),
  ])
  const { NachweisKontext } = await import('@/lib/bescheid/domain')
  const kontext = new NachweisKontext(
    { bescheid: bundle?.bescheid ?? null, vnw: vnw ?? null, belege },
  )
  if (!kontext.darfEinreichen) {
    return { ok: false, fehler: `Noch nicht möglich: ${kontext.fehlendeBausteine.join(', ')}.` }
  }
  if (vnw?.status === 'eingereicht') return { ok: true, hinweis: 'Bereits eingereicht.' }

  try {
    await markiereVnwEingereicht(angebotId, zugriff.session.user.id)
    const wechsel = await wechsleStatusMitProtokoll(angebotId, 'vnw_eingereicht', zugriff)
    await audit(angebotId, `${zugriff.rolle}:${zugriff.session.user.id}`, 'vnw_eingereicht', {
      belege: belege.length,
      beleg_summe_eur: kontext.belegSummeEur,
      frist_am: kontext.wirksameFrist,
      statuswechsel: wechsel,
    })
    revalidatePath(`/konto/vorgang/${angebotId}`)
    revalidatePath('/admin/kunden')
    return { ok: true, hinweis: 'Verwendungsnachweis als eingereicht markiert – die Fristuhr steht still.' }
  } catch (e) {
    loggeFehler('bescheid', e, { route: 'vnw_einreichen', angebotId })
    return { ok: false, fehler: e instanceof Error ? e.message : 'Einreichung fehlgeschlagen.' }
  }
}
