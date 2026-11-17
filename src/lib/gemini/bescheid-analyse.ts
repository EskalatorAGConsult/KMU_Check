import 'server-only'

import { frageGeminiMitPdf } from './client'
import { parseBescheidAnalyse, type BescheidAnalyse } from './bescheid-parser'

export type { BescheidAnalyse } from './bescheid-parser'

/**
 * Gemini-Analyse des BAFA-Zuwendungsbescheids (OCR): liest Aktenzeichen,
 * Bewilligungsdaten, Durchführungszeitraum, VNW-Vorlagefrist sowie
 * Auflagen/Hinweise aus. Ergebnis ist ein ROHBEFUND – bestätigt werden die
 * Werte von Mensch (Kunde/Admin) in speichereBescheidDaten (Human-in-the-
 * loop, gleiches Muster wie die Angebots-Extraktion).
 */

const PROMPT = `Du bist ein präziser Datenextraktor für deutsche Förderbescheide. Das beigefügte PDF ist ein
Zuwendungsbescheid des Bundesamts für Wirtschaft und Ausfuhrkontrolle (BAFA) aus dem Programm
„Energie- und Ressourceneffizienz in der Wirtschaft (EEW)“ – typischerweise Modul 3
(MSR-Technik, Sensorik, Energiemanagement-Software).

Antworte NUR als JSON-Objekt mit exakt diesen Schlüsseln (null bzw. leeres Array, wenn nicht im Dokument):
- aktenzeichen: Aktenzeichen/Geschäftszeichen des Bescheids (z. B. „…/EEW-Modul 3/…“)
- bewilligt_am: Datum des Bescheids als YYYY-MM-DD (Ausstellungsdatum, NICHT Antragsdatum)
- foerderquote_pct: bewilligte Förderquote in Prozent als Zahl (25, 35 oder 45)
- foerdersumme_eur: bewilligter Zuschuss in EUR als Zahl (ohne Währungszeichen)
- durchfuehrung_von: Beginn des Bewilligungs-/Durchführungszeitraums als YYYY-MM-DD
- durchfuehrung_bis: Ende des Bewilligungs-/Durchführungszeitraums als YYYY-MM-DD
- vnw_frist_am: Frist zur Vorlage des Verwendungsnachweises als YYYY-MM-DD (Suchwörter: „Verwendungsnachweis“, „vorzulegen“, „Vorlagefrist“, „innerhalb von … Monaten“; wenn nur eine Monatsfrist genannt ist, berechne das konkrete Datum ab Ende des Durchführungszeitraums)
- auflagen: Array von Auflagen/Nebenbestimmungen als Kurzsätze (wörtlich gefasst, je max. 1 Satz)
- hinweise: Array sonstiger wichtiger Hinweise (z. B. Auszahlungsvoraussetzungen, Mittelabruf, vorzeitiger Maßnahmebeginn)

Regeln: Keine Werte erfinden oder runden – steht etwas nicht eindeutig im Dokument: null.
Datumsangaben im deutschen Format (TT.MM.JJJJ) in YYYY-MM-DD umwandeln. Keine Erläuterungen, nur JSON.`

export type BescheidErgebnis =
  | { ok: true; analyse: BescheidAnalyse }
  | { ok: false; fehler: string }

/** Analysiert ein Bescheid-PDF. Liefert im Fehlerfall den konkreten Grund. */
export async function analysiereBescheid(pdf: Uint8Array): Promise<BescheidErgebnis> {
  const res = await frageGeminiMitPdf(PROMPT, pdf)
  if (!res.ok) return res
  const analyse = parseBescheidAnalyse(res.text)
  if (!analyse) {
    return { ok: false, fehler: 'Im Bescheid wurden keine verwertbaren Daten erkannt (leere KI-Antwort).' }
  }
  return { ok: true, analyse }
}
