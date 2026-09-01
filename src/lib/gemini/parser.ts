/**
 * Gemini-Analyse des MABE-Angebots-PDF: reiner Parser fuer die
 * Modell-Antwort. Framework- und netzwerkfrei – voll testbar.
 *
 * Das Modell (gemini-2.5-flash, Multimodal/OCR) liest das PDF und liefert
 * JSON gemaess PROMPT; diese Funktion validiert und normalisiert es
 * defensiv (nie Exceptions bei KI-Ausgaben, immer best effort).
 */

export interface AngebotAnalyse {
  /** Adressat des Angebots (Kundenfirma). */
  kunde_firma: string | null
  kunde_ansprechpartner: string | null
  kunde_email: string | null
  strasse: string | null
  plz: string | null
  ort: string | null
  /** Umsatzsteuer-Identifikationsnummer des Kunden (DE…), falls im Angebot. */
  ust_id: string | null
  angebot_nr: string | null
  /** ISO-Datum YYYY-MM-DD. */
  angebot_datum: string | null
  invest_software: number | null
  invest_messtechnik: number | null
  invest_steuerung: number | null
  sensoren_gesamt: number | null
  sensoren_prozessbezug: number | null
  projektende: string | null
}

const LEER: AngebotAnalyse = {
  kunde_firma: null,
  kunde_ansprechpartner: null,
  kunde_email: null,
  strasse: null,
  plz: null,
  ort: null,
  ust_id: null,
  angebot_nr: null,
  angebot_datum: null,
  invest_software: null,
  invest_messtechnik: null,
  invest_steuerung: null,
  sensoren_gesamt: null,
  sensoren_prozessbezug: null,
  projektende: null,
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
  // Deutsches Format: 1.234.567,89 -> 1234567.89
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

function ganzzahl(v: unknown): number | null {
  const n = betrag(v)
  return n === null ? null : Math.round(n)
}

/** „12.03.2026" oder „2026-03-12" -> „2026-03-12"; sonst null. */
function datum(v: unknown): string | null {
  const t = text(v)
  if (!t) return null
  if (ISO_DATUM.test(t)) return t
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

/** USt-Id normalisieren: Leerzeichen raus, Länderpräfix gross. */
function ustId(v: unknown): string | null {
  const t = text(v)
  if (!t) return null
  const norm = t.replace(/\s+/g, '').toUpperCase()
  return /^[A-Z]{2}[A-Z0-9]{8,12}$/.test(norm) ? norm : null
}

/**
 * Parst die Rohtext-Antwort des Modells (trotz responseMimeType=json kann
 * sie in Markdown-Codefences verpackt sein). Ungueltiges JSON -> null.
 */
export function parseAngebotAnalyse(roh: string): AngebotAnalyse | null {
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

  const analyse: AngebotAnalyse = {
    ...LEER,
    kunde_firma: text(o.kunde_firma),
    kunde_ansprechpartner: text(o.kunde_ansprechpartner),
    kunde_email: text(o.kunde_email),
    strasse: text(o.strasse),
    plz: text(o.plz),
    ort: text(o.ort),
    ust_id: ustId(o.ust_id),
    angebot_nr: text(o.angebot_nr),
    angebot_datum: datum(o.angebot_datum),
    invest_software: betrag(o.invest_software),
    invest_messtechnik: betrag(o.invest_messtechnik),
    invest_steuerung: betrag(o.invest_steuerung),
    sensoren_gesamt: ganzzahl(o.sensoren_gesamt),
    sensoren_prozessbezug: ganzzahl(o.sensoren_prozessbezug),
    projektende: datum(o.projektende),
  }
  // Vollstaendig leere Antwort ist kein Ergebnis
  if (Object.values(analyse).every((v) => v === null)) return null
  return analyse
}
