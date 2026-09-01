import 'server-only'

import { parseAngebotAnalyse, type AngebotAnalyse } from './parser'

export type { AngebotAnalyse } from './parser'

/**
 * Gemini-API-Client (server-only): liest das MABE-Angebots-PDF multimodal
 * (OCR) und extrahiert die Felder fuer das Angebotsformular.
 *
 * API: generativelanguage.googleapis.com, Modell gemini-2.5-flash,
 * PDF inline als base64 (inline_data), Antwort erzwungen als JSON.
 * Key aus GEMINI_API_KEY (nie an den Client). Best effort: Fehler -> null.
 */

// gemini-2.5-flash wurde von Google abgeschaltet (HTTP 404, Stand 2026-09);
// die API selbst empfiehlt gemini-3.6-flash – live gegen den Endpoint verifiziert.
const MODELL = 'gemini-3.6-flash'
const ENDPUNKT = `https://generativelanguage.googleapis.com/v1beta/models/${MODELL}:generateContent`
const MAX_PDF_BYTES = 15 * 1024 * 1024 // 15 MB inline-Limit weit unter API-Grenze

const PROMPT = `Du bist ein präziser Datenextraktor. Das beigefügte PDF ist ein Verkaufsangebot der Firma
MABE Maschinen- und Behälterbau GmbH (Absender!) an einen Kunden (Adressat).
Extrahiere AUSSCHLIESSLICH Daten des ADRESSATEN (Kunden), niemals die der MABE.

Antworte NUR als JSON-Objekt mit exakt diesen Schlüsseln (null, wenn nicht im Dokument):
- kunde_firma: vollständiger Firmenname des Adressaten inkl. Rechtsform
- kunde_ansprechpartner: Name der Ansprechperson beim Kunden (aus Anrede/Zu-Handen-Vermerk)
- kunde_email: E-Mail des Kunden, falls genannt
- strasse, plz, ort: Anschrift des Kunden (Straße mit Hausnummer)
- ust_id: Umsatzsteuer-Identifikationsnummer des Kunden (z. B. DE123456789), falls genannt
- angebot_nr: Angebotsnummer des Dokuments
- angebot_datum: Angebotsdatum als YYYY-MM-DD
- invest_software: Summe Positionen Energiemanagement-Software/Cloud in EUR (netto, Zahl)
- invest_messtechnik: Summe Mess-/Sensor-/Zählertechnik in EUR (netto, Zahl)
- invest_steuerung: Summe Steuerungs-/Regelungstechnik in EUR (netto, Zahl)
- sensoren_gesamt: Anzahl Messstellen/Sensoren gesamt (Ganzzahl)
- sensoren_prozessbezug: davon mit Prozessbezug (Ganzzahl)
- projektende: genannter Fertigstellungstermin als YYYY-MM-DD

Regeln: Beträge netto ohne Währungszeichen als Zahl. Keine Ratenwerte erfinden –
wenn eine Angabe nicht eindeutig im Dokument steht: null. Keine Erläuterungen, nur JSON.`

/** Analysiert ein Angebots-PDF. Fehler (Key, Netz, 4xx/5xx, Parse) -> null. */
export async function analysiereAngebot(pdf: Uint8Array): Promise<AngebotAnalyse | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  if (pdf.length > MAX_PDF_BYTES) {
    console.error(`[gemini] PDF zu gross (${pdf.length} Bytes)`)
    return null
  }
  try {
    const res = await fetch(ENDPUNKT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: Buffer.from(pdf).toString('base64') } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      console.error(`[gemini] generateContent -> HTTP ${res.status}`)
      return null
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const roh = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    return parseAngebotAnalyse(roh)
  } catch (e) {
    console.error('[gemini] Analyse fehlgeschlagen:', e)
    return null
  }
}
