import { feldLabel } from './feld-labels'

/**
 * Pflichtfeld-Pruefung fuer die ERSTANLAGE von Stammdaten durch einen Admin
 * (Fördermittelberater handelt im Namen des Kunden). Spiegelt die
 * NOT-NULL-Spalten der Tabelle stammdaten – rein und framework-frei testbar.
 */

const STRING_PFLICHT = ['unternehmensname', 'land', 'plz', 'ort', 'strasse', 'email', 'wz_code'] as const
const ENUM_PFLICHT = ['unternehmensart', 'personenart', 'gruppenzugehoerigkeit'] as const
const BOOLEAN_PFLICHT = ['vorsteuerabzug', 'wirtschaftlich_taetig'] as const

/** Deutsche Labels der fehlenden Pflichtfelder (leer = alles vorhanden). */
export function fehlendeStammdatenPflichtfelder(eingabe: Record<string, unknown>): string[] {
  const fehlend: string[] = []
  for (const feld of STRING_PFLICHT) {
    const v = eingabe[feld]
    if (v === undefined || v === null || String(v).trim() === '') fehlend.push(feldLabel(feld))
  }
  for (const feld of ENUM_PFLICHT) {
    const v = eingabe[feld]
    if (v === undefined || v === null || String(v).trim() === '') fehlend.push(feldLabel(feld))
  }
  for (const feld of BOOLEAN_PFLICHT) {
    if (typeof eingabe[feld] !== 'boolean') fehlend.push(feldLabel(feld))
  }
  // Bedingte Pflicht laut Tabellen-CHECK (03_tables.sql): natuerlich ->
  // Geburtsdatum + Steuer-ID, juristisch -> Steuernummer. Sonst scheitert
  // der Insert an der DB-Constraint statt mit verstaendlicher Feldliste.
  const personenart = String(eingabe.personenart ?? '').trim()
  const leer = (feld: string) => {
    const v = eingabe[feld]
    return v === undefined || v === null || String(v).trim() === ''
  }
  if (personenart === 'natuerlich') {
    if (leer('geburtsdatum')) fehlend.push(feldLabel('geburtsdatum'))
    if (leer('steuer_id')) fehlend.push(feldLabel('steuer_id'))
  } else if (personenart === 'juristisch') {
    if (leer('steuernummer')) fehlend.push(feldLabel('steuernummer'))
  }
  return fehlend
}
