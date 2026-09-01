/**
 * CSV-Builder (Excel-DE-Konvention): Trennzeichen Semikolon, Werte mit
 * Sonderzeichen in doppelten Anfuehrungszeichen, BOM fuer korrekte
 * UTF-8-Erkennung in Excel. Rein, framework-frei, ohne Seiteneffekte.
 */

export type CsvWert = string | number | null | undefined

function esc(wert: CsvWert): string {
  if (wert === null || wert === undefined) return ''
  const s = typeof wert === 'number' ? String(wert).replace('.', ',') : wert
  // Excel-Formel-Injektion (CWE-1236): Anfuehrungszeichen verhindern die
  // Formel-Interpretation NICHT – fuehrende Formelzeichen neutralisieren
  // (Apostroph-Praefix, OWASP-Empfehlung). Zahlen bleiben unberuehrt.
  const neutral =
    typeof wert === 'string' && /^[=+\-@\t\r]/.test(wert.trim()) ? `'${s}` : s
  if (/[;\n\r"]/.test(neutral)) return `"${neutral.replace(/"/g, '""')}"`
  return neutral
}

export function csvZeile(werte: CsvWert[]): string {
  return werte.map(esc).join(';')
}

/** Komplettes CSV-Dokument mit Kopfzeile und UTF-8-BOM. */
export function baueCsv(kopf: string[], zeilen: CsvWert[][]): string {
  const body = [csvZeile(kopf), ...zeilen.map(csvZeile)].join('\r\n')
  return `﻿${body}\r\n`
}
