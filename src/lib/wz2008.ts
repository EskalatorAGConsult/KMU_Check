import daten from './wz2008.json'

/**
 * Offizielle WZ-2008-Klassifikation (Klassifikation der Wirtschaftszweige,
 * Ausgabe 2008) des Statistischen Bundesamtes (Destatis) – 1.835 Codes mit
 * amtlicher Bezeichnung: Abschnitte A–U, Abteilungen, Gruppen, Klassen,
 * Unterklassen.
 *
 * Aufbau: scripts/build_wz2008.py parst die offizielle Gliederung (Destatis-
 * PDF). Bei Aktualisierung der Klassifikation: Skript erneut ausfuehren.
 * Hinweis: WZ 2025 wird ab 2025/2028 schrittweise eingefuehrt; das BAFA-Portal
 * fragt aktuell den WZ-Code (2008) ab.
 */
export const WZ2008: Record<string, string> = daten as Record<string, string>

/** Amtliche Bezeichnung eines WZ-2008-Codes (null = nicht in der Liste). */
export function wzCodeBezeichnung(code: string): string | null {
  return WZ2008[code.trim().toUpperCase()] ?? null
}

/** Ist der Code in der offiziellen WZ-2008-Liste enthalten? */
export function istWzCodeBekannt(code: string): boolean {
  return wzCodeBezeichnung(code) !== null
}
