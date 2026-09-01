/**
 * Revisions-Diff (rein, framework-frei): vergleicht einen bestehenden
 * Datensatz mit dem Admin-Patch und liefert nur die tatsaechlich
 * geaenderten Felder als { feld: { alt, neu } }. Grundlage der Tabelle
 * vorgang_revisionen (Migration 19) – voll testbar ohne DB.
 *
 * Normalisierung: '' und null gelten als gleich (leere Formularfelder),
 * Zahlen werden numerisch verglichen (PostgREST liefert numeric teils als
 * String), Arrays (technologien) mengen- bzw. reihenfolgenstabil.
 */

export interface FeldAenderung {
  alt: unknown
  neu: unknown
}

export type Aenderungen = Record<string, FeldAenderung>

function normalisiere(wert: unknown): unknown {
  if (wert === undefined || wert === null) return null
  if (typeof wert === 'string') {
    const t = wert.trim()
    if (t === '') return null
    const n = Number(t.replace(',', '.'))
    // Numerische Strings („26750.5" aus numeric-Spalten) als Zahl vergleichen
    if (/^-?\d+([.,]\d+)?$/.test(t) && Number.isFinite(n)) return n
    return t
  }
  if (typeof wert === 'number') return Number.isFinite(wert) ? wert : null
  if (Array.isArray(wert)) return JSON.stringify(wert)
  return wert
}

/**
 * Bildet den Diff ueber die Whitelist `felder`. Nur Felder aus der Liste
 * werden ueberhaupt betrachtet (Schutz gegen Mass-Assignment); unveraenderte
 * Felder tauchen nicht im Ergebnis auf.
 */
export function bildeDiff(
  alt: Record<string, unknown>,
  neu: Record<string, unknown>,
  felder: readonly string[],
): Aenderungen {
  const diff: Aenderungen = {}
  for (const feld of felder) {
    const a = normalisiere(alt[feld])
    const n = normalisiere(neu[feld])
    const gleich = typeof a === 'string' && typeof n === 'string' ? a === n : a === n
    if (!gleich) diff[feld] = { alt: alt[feld] ?? null, neu: neu[feld] ?? null }
  }
  return diff
}

/** true, wenn der Diff mindestens eine Aenderung enthaelt. */
export function hatAenderungen(diff: Aenderungen): boolean {
  return Object.keys(diff).length > 0
}

/** Deutsche Anzeige eines Feldwerts in der Historie (null -> „–"). */
export function formatiereWert(wert: unknown): string {
  if (wert === null || wert === undefined || wert === '') return '–'
  if (typeof wert === 'boolean') return wert ? 'Ja' : 'Nein'
  if (typeof wert === 'number') return wert.toLocaleString('de-DE')
  if (Array.isArray(wert)) return wert.join(', ')
  return String(wert)
}
