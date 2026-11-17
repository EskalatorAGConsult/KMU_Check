/**
 * Gemini-Analyse des BAFA-Zuwendungsbescheids: reiner Parser fuer die
 * Modell-Antwort. Framework- und netzwerkfrei – voll testbar.
 *
 * Defensiv wie angebot-parser.ts: nie Exceptions bei KI-Ausgaben, alles
 * normalisiert, NICHTS wird erfunden – fehlende Felder bleiben null.
 * Die verbindliche Frist steht im jeweiligen Bescheid (BAFA-Merkblatt);
 * ein Default-Fristwert waere eine Annahme und ist deshalb verboten.
 */

export interface BescheidAnalyse {
  /** BAFA-Aktenzeichen/Geschäftszeichen des Bescheids (z. B. zuwendungsrechtlich). */
  aktenzeichen: string | null
  /** Datum des Bescheids (ISO YYYY-MM-DD). */
  bewilligt_am: string | null
  /** Bewilligte Förderquote in Prozent (25/35/45 laut Programm). */
  foerderquote_pct: 25 | 35 | 45 | null
  /** Bewilligter Zuschuss in EUR. */
  foerdersumme_eur: number | null
  /** Beginn des Bewilligungs-/Durchführungszeitraums (ISO). */
  durchfuehrung_von: string | null
  /** Ende des Bewilligungs-/Durchführungszeitraums (ISO). */
  durchfuehrung_bis: string | null
  /** Vorlagefrist Verwendungsnachweis laut Bescheid (ISO) – der WICHTIGSTE Wert. */
  vnw_frist_am: string | null
  /** Auflagen/Nebenbestimmungen als Liste (Kurzzitate). */
  auflagen: string[]
  /** Sonstige Hinweise (z. B. Auszahlungsvoraussetzungen, Mittelabruf). */
  hinweise: string[]
}

const LEER: BescheidAnalyse = {
  aktenzeichen: null,
  bewilligt_am: null,
  foerderquote_pct: null,
  foerdersumme_eur: null,
  durchfuehrung_von: null,
  durchfuehrung_bis: null,
  vnw_frist_am: null,
  auflagen: [],
  hinweise: [],
}

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/

function text(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

/** „12.345,67" / „12345.67" / 12345.67 -> number; sonst null. */
function betrag(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.round(v * 100) / 100
  if (typeof v !== 'string') return null
  let s = v.trim().replace(/[€\s]/g, '')
  if (!s) return null
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

/** „12.03.2026" oder "2026-03-12" -> "2026-03-12"; sonst null. */
function datum(v: unknown): string | null {
  const t = text(v)
  if (!t) return null
  if (ISO_DATUM.test(t)) return t
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

/** Förderquote: nur gültige Programm-Werte, sonst null (niemals runden/raten). */
function quote(v: unknown): 25 | 35 | 45 | null {
  const n = betrag(v)
  if (n === 25 || n === 35 || n === 45) return n
  return null
}

/** String-Liste: kürzt, entleert Duplikate, max. 20 Einträge je 500 Zeichen. */
function liste(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const gesehen = new Set<string>()
  const aus: string[] = []
  for (const roh of v) {
    if (typeof roh !== 'string') continue
    const t = roh.trim().slice(0, 500)
    if (!t || gesehen.has(t)) continue
    gesehen.add(t)
    aus.push(t)
    if (aus.length >= 20) break
  }
  return aus
}

/**
 * Parst die Rohtext-Antwort des Modells (trotz responseMimeType=json kann
 * sie in Markdown-Codefences verpackt sein). Ungueltiges JSON -> null.
 */
export function parseBescheidAnalyse(roh: string): BescheidAnalyse | null {
  const bereinigt = roh
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
  let obj: unknown
  try {
    obj = JSON.parse(bereinigt)
  } catch {
    return null
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null
  const o = obj as Record<string, unknown>

  const analyse: BescheidAnalyse = {
    ...LEER,
    aktenzeichen: text(o.aktenzeichen),
    bewilligt_am: datum(o.bewilligt_am),
    foerderquote_pct: quote(o.foerderquote_pct),
    foerdersumme_eur: betrag(o.foerdersumme_eur),
    durchfuehrung_von: datum(o.durchfuehrung_von),
    durchfuehrung_bis: datum(o.durchfuehrung_bis),
    vnw_frist_am: datum(o.vnw_frist_am),
    auflagen: liste(o.auflagen),
    hinweise: liste(o.hinweise),
  }
  // Vollstaendig leere Antwort ist kein Ergebnis (nichts erfinden).
  const nurLeer =
    analyse.aktenzeichen === null &&
    analyse.bewilligt_am === null &&
    analyse.foerderquote_pct === null &&
    analyse.foerdersumme_eur === null &&
    analyse.durchfuehrung_von === null &&
    analyse.durchfuehrung_bis === null &&
    analyse.vnw_frist_am === null &&
    analyse.auflagen.length === 0 &&
    analyse.hinweise.length === 0
  if (nurLeer) return null
  return analyse
}
