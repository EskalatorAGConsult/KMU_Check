'use server'

import { z } from 'zod'

import { requireAdmin } from '@/lib/auth/guards'
import { erstelleAngebot, type NeuesAngebot } from '@/lib/db/repositories/angebote'
import { supabaseServer } from '@/lib/db/server'
import { audit, erstelleJourneyToken, setzeAngebotStatus, speichereFortschritt } from '@/lib/db/repositories/journey'
import { sendeEinladung } from '@/lib/email/notify'
import { analysiereAngebot, type AngebotAnalyse } from '@/lib/gemini/angebot-analyse'
import { ladeDokumentHoch } from '@/lib/storage/blob'

const schema = z.object({
  kunde_firma: z.string().trim().min(2, 'Firmenname fehlt.').max(200),
  kunde_ansprechpartner: z.string().trim().optional(),
  kunde_email: z.email('Gültige E-Mail des Kunden fehlt.'),
  angebot_nr: z.string().trim().min(1, 'Angebotsnummer fehlt.'),
  angebot_datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Angebotsdatum fehlt.'),
  technologien: z
    .array(z.enum(['software', 'messtechnik', 'steuerung']))
    .min(1, 'Bitte mindestens eine Technologie wählen.'),
  software_variante: z.enum(['mabe_cloud', 'andere', 'offen']).optional(),
  invest_software: z.coerce.number().min(0).optional(),
  invest_messtechnik: z.coerce.number().min(0).optional(),
  invest_steuerung: z.coerce.number().min(0).optional(),
  sensoren_gesamt: z.coerce.number().int().min(0).optional(),
  sensoren_prozessbezug: z.coerce.number().int().min(0).optional(),
  projektende: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  notiz: z.string().trim().optional(),
  // Gemini-Extraktion aus dem hochgeladenen Angebots-PDF (ungepruefter Rohbefund)
  extraktion: z.record(z.string(), z.unknown()).optional(),
})

export type AdminActionErgebnis =
  | { ok: true; angebotId: string; link: string }
  | { ok: false; fehler: string }

/** Legt ein Angebot an, erzeugt den Journey-Link und markiert es als eingeladen. */
export async function erstelleAngebotAction(eingabe: NeuesAngebot): Promise<AdminActionErgebnis> {
  const session = await requireAdmin()

  const res = schema.safeParse(eingabe)
  if (!res.success) {
    return { ok: false, fehler: res.error.issues[0]?.message ?? 'Eingaben unvollständig.' }
  }

  try {
    const angebotId = await erstelleAngebot(session.user.id, {
      ...res.data,
      projektende: res.data.projektende || undefined,
    })
    const klartext = await erstelleJourneyToken(angebotId)
    await setzeAngebotStatus(angebotId, 'eingeladen')
    await audit(angebotId, `admin:${session.user.id}`, 'angebot_angelegt', {
      angebot_nr: res.data.angebot_nr,
      kunde_firma: res.data.kunde_firma,
    })

    // Journey-Draft vorbefuellen: Adresse/USt-Id aus der Gemini-Extraktion
    // (der Kunde prueft die Werte im Schritt „Ihr Unternehmen" nur noch).
    const ex = res.data.extraktion as Partial<AngebotAnalyse> | undefined
    if (ex && (ex.strasse || ex.plz || ex.ort || ex.ust_id || ex.kunde_firma)) {
      try {
        await speichereFortschritt(
          angebotId,
          'unternehmen',
          {
            unternehmensname: ex.kunde_firma ?? undefined,
            strasse: ex.strasse ?? undefined,
            plz: ex.plz ?? undefined,
            ort: ex.ort ?? undefined,
            ust_id: ex.ust_id ?? undefined,
          },
          'uebersicht',
        )
      } catch (e) {
        console.error('[admin] Draft-Vorbefüllung fehlgeschlagen:', e)
      }
    }

    // Einladungs-E-Mail mit dem persoenlichen Link (best effort).
    const invest =
      (res.data.invest_software ?? 0) + (res.data.invest_messtechnik ?? 0) + (res.data.invest_steuerung ?? 0)
    const mailGesendet = await sendeEinladung({
      an: res.data.kunde_email,
      kundeFirma: res.data.kunde_firma,
      angebotNr: res.data.angebot_nr,
      journeyPfad: `/v/${klartext}`,
      ansprechpartner: res.data.kunde_ansprechpartner,
      zuschussBisZu: invest > 0 ? invest * 0.45 : null,
    })
    await audit(angebotId, 'system', 'einladung_email', { gesendet: mailGesendet })

    return { ok: true, angebotId, link: `/v/${klartext}` }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Anlegen fehlgeschlagen.' }
  }
}

// ---------- Angebots-PDF: KI-Analyse (Gemini) + Archivierung ----------

export type AnalyseErgebnis =
  | { ok: true; analyse: AngebotAnalyse }
  | { ok: false; fehler: string }

const MAX_UPLOAD = 15 * 1024 * 1024

/** Liest und validiert die hochgeladene PDF-Datei aus einer FormData. */
async function validierePdf(formData: FormData): Promise<{ bytes: Uint8Array; name: string } | { fehler: string }> {
  const datei = formData.get('datei')
  if (!(datei instanceof File) || datei.size === 0) return { fehler: 'Keine Datei übergeben.' }
  if (datei.size > MAX_UPLOAD) return { fehler: 'Die Datei ist größer als 15 MB.' }
  const bytes = new Uint8Array(await datei.arrayBuffer())
  // PDF-Magic-Bytes pruefen (MIME-Type des Clients ist vertrauensunwuerdig)
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    return { fehler: 'Die Datei ist keine PDF (unerwartetes Dateiformat).' }
  }
  return { bytes, name: datei.name }
}

/**
 * Analysiert das Angebots-PDF mit Gemini (OCR) und liefert die extrahierten
 * Felder zum Vorbefuellen des Formulars. Persistiert nichts.
 */
export async function analysiereAngebotPdf(formData: FormData): Promise<AnalyseErgebnis> {
  const session = await requireAdmin()
  const geprueft = await validierePdf(formData)
  if ('fehler' in geprueft) return { ok: false, fehler: geprueft.fehler }

  const analyse = await analysiereAngebot(geprueft.bytes)
  await audit(null, `admin:${session.user.id}`, 'angebot_pdf_analyse', {
    datei: geprueft.name,
    erfolg: !!analyse,
  })
  if (!analyse) {
    return {
      ok: false,
      fehler:
        'Das Angebot konnte nicht automatisch gelesen werden (KI nicht erreichbar oder nichts erkannt). Bitte die Felder manuell ausfüllen – das PDF wird beim Anlegen trotzdem archiviert.',
    }
  }
  return { ok: true, analyse }
}

/**
 * Archiviert das Angebots-PDF zum Vorgang (Vercel Blob) und vermerkt Pfad +
 * Extraktion am Angebot. Best effort: Fehler werden als Meldung zurueck-
 * gegeben, der Vorgang selbst bleibt bestehen.
 */
export async function speichereAngebotPdf(
  angebotId: string,
  formData: FormData,
  extraktion: AngebotAnalyse | null,
): Promise<{ ok: boolean; fehler?: string }> {
  const session = await requireAdmin()
  const geprueft = await validierePdf(formData)
  if ('fehler' in geprueft) return { ok: false, fehler: geprueft.fehler }

  try {
    const { data: angebot } = await supabaseServer()
      .from('angebote')
      .select('angebot_nr')
      .eq('id', angebotId)
      .single()
    const url = await ladeDokumentHoch(`angebote/${angebot?.angebot_nr ?? angebotId}.pdf`, geprueft.bytes)

    const { error } = await supabaseServer()
      .from('angebote')
      .update({
        angebot_pdf_path: url,
        extraktion: extraktion ?? null,
        extrahiert_am: extraktion ? new Date().toISOString() : null,
      })
      .eq('id', angebotId)
    if (error) throw new Error(error.message)

    await audit(angebotId, `admin:${session.user.id}`, 'angebot_pdf_archiviert', {
      datei: geprueft.name,
      gespeichert: !!url,
      mit_extraktion: !!extraktion,
    })
    return url ? { ok: true } : { ok: false, fehler: 'Storage nicht konfiguriert – PDF wurde nicht archiviert.' }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'PDF-Archivierung fehlgeschlagen.' }
  }
}
