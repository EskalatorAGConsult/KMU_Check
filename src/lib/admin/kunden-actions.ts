'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/guards'
import { validiereUploadDatei } from '@/lib/admin/datei-upload'
import { erlaubteZiele, istUebergangErlaubt } from '@/lib/admin/status'
import { listeSystemkonzeptVorlagen, type SystemkonzeptVorlage } from '@/lib/admin/systemkonzept-actions'
import { holeAngebot, loescheAngebot } from '@/lib/db/repositories/angebote'
import { holeKunde, type KundeDetail } from '@/lib/db/repositories/kunden'
import { audit, erstelleJourneyToken, setzeAngebotStatus } from '@/lib/db/repositories/journey'
import { fuegeNotizHinzu, loescheNotiz } from '@/lib/db/repositories/notizen'
import { speichereRevision } from '@/lib/db/repositories/revisionen'
import { supabaseServer } from '@/lib/db/server'
import type { AngebotStatus } from '@/lib/db/types'
import { portalUrl } from '@/lib/email/resend'
import { sendeEinladung } from '@/lib/email/notify'
import { ANGEBOT_STATUS_LABELS } from '@/lib/labels'
import { ladeDokumentHoch } from '@/lib/storage/blob'

export type KundeActionErgebnis = { ok: true; hinweis: string } | { ok: false; fehler: string }

/**
 * Laedt die vollstaendige Fallakte eines Kunden (alle Vorgaenge mit
 * Stammdaten, Verbund, KMU-Bewertungen, De-minimis, Vollmacht, Dokumenten,
 * Entwuerfen, Uebergaben und Audit-Trail) fuer die aufklappbare
 * Kundenuebersicht. Admin-guarded; Ergebnis ist JSON-serialisierbar.
 */
export async function ladeFallakte(
  email: string,
): Promise<
  | { ok: true; kunde: KundeDetail; vorlagen: SystemkonzeptVorlage[] }
  | { ok: false; fehler: string }
> {
  await requireAdmin()
  const bereinigt = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(bereinigt)) {
    return { ok: false, fehler: 'Ungültige E-Mail-Adresse.' }
  }
  try {
    const [kunde, vorlagen] = await Promise.all([holeKunde(bereinigt), listeSystemkonzeptVorlagen()])
    if (!kunde) return { ok: false, fehler: 'Kunde nicht gefunden.' }
    return { ok: true, kunde, vorlagen }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Fallakte konnte nicht geladen werden.' }
  }
}

/**
 * Sendet die Einladungs-E-Mail mit einem frischen Journey-Link an den Kunden.
 * Dient als Erstversand (Status 'angelegt', nach dem Anlegen ohne Auto-Versand)
 * und als erneuter Versand (Mail verloren / Link abgelaufen). Setzt den
 * Vorgang auf 'eingeladen'.
 */
export async function erneutEinladen(angebotId: string): Promise<KundeActionErgebnis> {
  const session = await requireAdmin()
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }
  if (['eingereicht', 'abgeschlossen', 'widerrufen'].includes(angebot.status)) {
    return { ok: false, fehler: `Vorgang ist bereits ${angebot.status} – keine erneute Einladung möglich.` }
  }

  try {
    const klartext = await erstelleJourneyToken(angebotId)
    await setzeAngebotStatus(angebotId, 'eingeladen')
    const versand = await sendeEinladung({
      an: angebot.kunde_email,
      kundeFirma: angebot.kunde_firma,
      angebotNr: angebot.angebot_nr,
      journeyPfad: `/v/${klartext}`,
      ansprechpartner: angebot.kunde_ansprechpartner ?? undefined,
    })
    await audit(angebotId, `admin:${session.user.id}`, 'einladung_gesendet', {
      gesendet: versand.ok,
      grund: versand.grund ?? null,
    })
    revalidatePath('/admin/kunden')
    return {
      ok: true,
      hinweis: versand.ok
        ? 'Einladung an den Kunden gesendet.'
        : `Neuer Link erstellt, aber E-Mail-Versand fehlgeschlagen (${versand.grund ?? 'unbekannt'}). Link: /v/${klartext}`,
    }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Erneutes Einladen fehlgeschlagen.' }
  }
}

/** Setzt einen Vorgang auf „widerrufen“ (Journey-Links verlieren damit ihre Gültigkeit). */
export async function widerrufeVorgang(angebotId: string): Promise<KundeActionErgebnis> {
  const session = await requireAdmin()
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }
  if (angebot.status === 'widerrufen') return { ok: false, fehler: 'Vorgang ist bereits widerrufen.' }

  try {
    await setzeAngebotStatus(angebotId, 'widerrufen')
    await audit(angebotId, `admin:${session.user.id}`, 'vorgang_widerrufen', {
      vorheriger_status: angebot.status,
    })
    revalidatePath('/admin/kunden')
    revalidatePath('/admin')
    return { ok: true, hinweis: 'Vorgang wurde widerrufen. Bestehende Kunden-Links sind damit ungültig.' }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Widerruf fehlgeschlagen.' }
  }
}

/**
 * Manueller Statuswechsel (Berater-Workflow, z. B. „abgeschlossen" nach der
 * BAFA-Einreichung im FZD-Portal). Erlaubte Uebergaenge definiert der Vertrag
 * in status.ts; jeder Wechsel wird als Revision (wer/wann/alt→neu) und als
 * audit_event protokolliert.
 */
export async function aendereVorgangStatus(angebotId: string, neuerStatus: AngebotStatus): Promise<KundeActionErgebnis> {
  const session = await requireAdmin()
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }
  if (neuerStatus === angebot.status) return { ok: true, hinweis: 'Status ist unverändert.' }
  if (!istUebergangErlaubt(angebot.status, neuerStatus)) {
    const ziele = erlaubteZiele(angebot.status).map((s) => ANGEBOT_STATUS_LABELS[s]).join(', ') || 'keine'
    return {
      ok: false,
      fehler: `Wechsel von „${ANGEBOT_STATUS_LABELS[angebot.status]}“ nach „${ANGEBOT_STATUS_LABELS[neuerStatus]}“ nicht erlaubt. Möglich: ${ziele}.`,
    }
  }

  try {
    await setzeAngebotStatus(angebotId, neuerStatus)
    await speichereRevision(angebotId, session.user.id, 'angebot', {
      status: { alt: angebot.status, neu: neuerStatus },
    })
    await audit(angebotId, `admin:${session.user.id}`, 'status_geaendert', { von: angebot.status, nach: neuerStatus })
    revalidatePath('/admin/kunden')
    revalidatePath('/admin')
    return {
      ok: true,
      hinweis: `Status geändert: ${ANGEBOT_STATUS_LABELS[angebot.status]} → ${ANGEBOT_STATUS_LABELS[neuerStatus]} (in der Historie protokolliert).`,
    }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Statuswechsel fehlgeschlagen.' }
  }
}

/**
 * Erstellt einen frischen Journey-Link zum Kopieren (z. B. fuer WhatsApp/
 * Telefon) – ohne E-Mail-Versand. Tokens werden gehasht gespeichert, alte
 * Links bleiben gueltig; jeder neue Link ist eigenstaendig widerrufbar.
 */
export async function erstelleJourneyLink(
  angebotId: string,
): Promise<{ ok: true; link: string; hinweis: string } | { ok: false; fehler: string }> {
  const session = await requireAdmin()
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }
  if (['eingereicht', 'abgeschlossen', 'widerrufen'].includes(angebot.status)) {
    return { ok: false, fehler: `Vorgang ist bereits ${angebot.status} – kein neuer Link nötig.` }
  }
  try {
    const klartext = await erstelleJourneyToken(angebotId)
    await audit(angebotId, `admin:${session.user.id}`, 'journey_link_erstellt', {})
    return {
      ok: true,
      link: portalUrl(`/v/${klartext}`),
      hinweis: 'Neuer Link erstellt und in die Zwischenablage kopiert. Er ist 90 Tage gültig.',
    }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Link konnte nicht erstellt werden.' }
  }
}

/**
 * Interne Notiz mit optionaler Wiedervorlage hinzufuegen (Migration 21).
 * Vertrag: Text 1–2000 Zeichen, Datum ISO JJJJ-MM-TT (optional).
 */
export async function notizHinzufuegen(
  angebotId: string,
  text: string,
  wiedervorlageAm: string | null,
): Promise<KundeActionErgebnis> {
  const session = await requireAdmin()
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }

  const bereinigt = text.trim()
  if (bereinigt.length < 1 || bereinigt.length > 2000) {
    return { ok: false, fehler: 'Die Notiz muss 1 bis 2000 Zeichen haben.' }
  }
  let datum: string | null = null
  if (wiedervorlageAm && wiedervorlageAm.trim() !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wiedervorlageAm.trim())) {
      return { ok: false, fehler: 'Wiedervorlage-Datum muss im Format JJJJ-MM-TT vorliegen.' }
    }
    datum = wiedervorlageAm.trim()
  }

  try {
    await fuegeNotizHinzu(angebotId, session.user.id, bereinigt, datum)
    await audit(angebotId, `admin:${session.user.id}`, 'notiz_hinzugefuegt', { wiedervorlage_am: datum })
    revalidatePath('/admin/kunden')
    return { ok: true, hinweis: 'Notiz gespeichert.' }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Notiz konnte nicht gespeichert werden.' }
  }
}

/** Loescht eine interne Notiz (Fehlkorrektur; wird auditiert). */
export async function notizLoeschen(notizId: string, angebotId: string): Promise<KundeActionErgebnis> {
  const session = await requireAdmin()
  try {
    await loescheNotiz(notizId, angebotId)
    await audit(angebotId, `admin:${session.user.id}`, 'notiz_geloescht', { notizId })
    revalidatePath('/admin/kunden')
    return { ok: true, hinweis: 'Notiz gelöscht.' }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Notiz konnte nicht gelöscht werden.' }
  }
}

/**
 * Generischer Dokumenten-Upload zur Fallakte (z. B. BAFA-Bescheid, Papier-
 * Vollmacht, Verwendungsnachweis). Validierung via Magic-Bytes (datei-upload.ts),
 * Ablage im Vercel Blob, Referenz als dokumente.typ 'upload'.
 */
export async function ladeDokumentHochAdmin(angebotId: string, formData: FormData): Promise<KundeActionErgebnis> {
  const session = await requireAdmin()
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }

  const datei = await validiereUploadDatei(formData)
  if ('fehler' in datei) return { ok: false, fehler: datei.fehler }

  try {
    const pfad = `uploads/${angebotId}/${Date.now()}-${datei.name}`
    const url = await ladeDokumentHoch(pfad, datei.bytes, datei.contentType)
    if (!url) return { ok: false, fehler: 'Storage nicht konfiguriert (Blob-Token fehlt).' }

    const db = supabaseServer()
    const { error } = await db.from('dokumente').insert({ angebot_id: angebotId, typ: 'upload', storage_path: url })
    if (error) throw new Error(error.message)

    await audit(angebotId, `admin:${session.user.id}`, 'dokument_hochgeladen', { datei: datei.name })
    revalidatePath('/admin/kunden')
    return { ok: true, hinweis: `„${datei.name}“ wurde zur Fallakte hochgeladen.` }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Upload fehlgeschlagen.' }
  }
}

/**
 * DSGVO-Loeschung (Art. 17) eines kompletten Vorgangs inkl. aller abhaengigen
 * Daten (Kaskade: Stammdaten, KMU, Beteiligungen, De-minimis, Vollmacht,
 * Tokens, Zugriffe, Notizen, Revisionen). Erfordert die Bestaetigung durch
 * Eingabe der Angebotsnummer; der Loeschnachweis bleibt als anonymisiertes
 * audit_event (ohne Vorgangsbezug) erhalten.
 */
export async function loescheVorgangDsgvo(angebotId: string, bestaetigung: string): Promise<KundeActionErgebnis> {
  const session = await requireAdmin()
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }
  if (bestaetigung.trim() !== angebot.angebot_nr) {
    return { ok: false, fehler: `Bitte zur Bestätigung exakt die Angebotsnummer „${angebot.angebot_nr}“ eingeben.` }
  }

  try {
    // Loeschnachweis VOR dem Loeschen schreiben (audit_events kaskadiert mit)
    await audit(null, `admin:${session.user.id}`, 'vorgang_dsgvo_geloescht', {
      angebot_nr: angebot.angebot_nr,
      kunde_firma: angebot.kunde_firma,
      kunde_email: angebot.kunde_email,
      bisheriger_status: angebot.status,
    })
    await loescheAngebot(angebotId)
    revalidatePath('/admin/kunden')
    revalidatePath('/admin')
    return {
      ok: true,
      hinweis: `Vorgang ${angebot.angebot_nr} wurde vollständig und DSGVO-konform gelöscht (Nachweis im Audit-Log).`,
    }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Löschung fehlgeschlagen.' }
  }
}
