'use server'

import { z } from 'zod'

import { requireAdmin } from '@/lib/auth/guards'
import { erstelleAngebot, type NeuesAngebot } from '@/lib/db/repositories/angebote'
import { supabaseServer } from '@/lib/db/server'
import { audit, erstelleJourneyToken, speichereFortschritt } from '@/lib/db/repositories/journey'
import { analysiereAngebot, type AngebotAnalyse } from '@/lib/gemini/angebot-analyse'
import { ladeDokumentHoch } from '@/lib/storage/blob'

import { validierePdf } from './pdf-upload'

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

/** Legt ein Angebot an und erzeugt den Journey-Link – OHNE E-Mail-Versand.
 * Die Einladungs-Mail wird bewusst entkoppelt: Der Vertrieb kopiert den Link
 * selbst oder loest den Versand spaeter manuell aus (Button in der Erfolgs-
 * ansicht bzw. „Einladung senden“ in der Kundenverwaltung). Erst dann gilt
 * der Vorgang als 'eingeladen' – nach dem Anlegen bleibt er 'angelegt'. */
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
    await audit(angebotId, `admin:${session.user.id}`, 'angebot_angelegt', {
      angebot_nr: res.data.angebot_nr,
      kunde_firma: res.data.kunde_firma,
    })
    await audit(angebotId, `admin:${session.user.id}`, 'journey_link_erstellt', { versand: 'manuell' })

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

    return { ok: true, angebotId, link: `/v/${klartext}` }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Anlegen fehlgeschlagen.' }
  }
}

// ---------- Angebots-PDF: KI-Analyse (Gemini) + Archivierung ----------

export type AnalyseErgebnis =
  | { ok: true; analyse: AngebotAnalyse }
  | { ok: false; fehler: string }

/**
 * Analysiert das Angebots-PDF mit Gemini (OCR) und liefert die extrahierten
 * Felder zum Vorbefuellen des Formulars. Persistiert nichts.
 */
export async function analysiereAngebotPdf(formData: FormData): Promise<AnalyseErgebnis> {
  const session = await requireAdmin()
  const geprueft = await validierePdf(formData)
  if ('fehler' in geprueft) return { ok: false, fehler: geprueft.fehler }

  const ergebnis = await analysiereAngebot(geprueft.bytes)
  await audit(null, `admin:${session.user.id}`, 'angebot_pdf_analyse', {
    datei: geprueft.name,
    erfolg: ergebnis.ok,
    ...(ergebnis.ok ? {} : { grund: ergebnis.fehler }),
  })
  if (!ergebnis.ok) {
    return {
      ok: false,
      fehler: `${ergebnis.fehler} Bitte die Felder manuell ausfüllen – das PDF wird beim Anlegen trotzdem archiviert.`,
    }
  }
  return { ok: true, analyse: ergebnis.analyse }
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
