import 'server-only'

import { frageGeminiMitPdf } from './client'
import { parseAngebotAnalyse, type AngebotAnalyse } from './parser'

export type { AngebotAnalyse } from './parser'

/**
 * Gemini-Analyse des MABE-Angebots-PDF (OCR): liest das Dokument multimodal
 * und extrahiert die Felder fuer das Angebotsformular. Der generische REST-
 * Call liegt in ./client.ts (geteilt mit der Bescheid-Analyse); diese Datei
 * enthaelt nur noch Prompt + Parsing. Fehler -> konkreter Grund.
 */

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

export type GeminiErgebnis =
  | { ok: true; analyse: AngebotAnalyse }
  | { ok: false; fehler: string }

/** Analysiert ein Angebots-PDF. Liefert im Fehlerfall den konkreten Grund. */
export async function analysiereAngebot(pdf: Uint8Array): Promise<GeminiErgebnis> {
  const res = await frageGeminiMitPdf(PROMPT, pdf)
  if (!res.ok) return res
  const analyse = parseAngebotAnalyse(res.text)
  if (!analyse) {
    return { ok: false, fehler: 'Im PDF wurden keine Angebotsdaten erkannt (leere KI-Antwort).' }
  }
  return { ok: true, analyse }
}
