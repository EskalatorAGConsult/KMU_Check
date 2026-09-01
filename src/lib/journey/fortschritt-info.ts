/**
 * Fortschritts-Vertrag der Journey (rein, testbar):
 * - `prozent` zaehlt ERLEDIGTE Schritte (Goal-Gradient: der Balken waechst
 *   durch Abschluss, nicht durchs blosse Anzeigen).
 * - `restMinuten` ist die dynamische Restzeit-Schaetzung (~75 s pro Schritt)
 *   – abnehmende Restzeit wirkt als Vollendungs-Pull.
 */
export interface FortschrittInfo {
  /** Erledigte Schritte (0 .. anzahl). */
  erledigt: number
  /** Fortschritt in Prozent (0 beim ersten Schritt, 100 nach dem letzten). */
  prozent: number
  /** Geschaetzte verbleibende Minuten (gerundet, min. 1 solange nicht fertig). */
  restMinuten: number
  fertig: boolean
}

/** Sekunden, die ein durchschnittlicher Schritt dauert (Erfahrungswert). */
const SEKUNDEN_PRO_SCHRITT = 75

export function fortschrittInfo(aktuellerIdx: number, anzahl: number): FortschrittInfo {
  const idx = Math.max(0, Math.min(aktuellerIdx, anzahl))
  const erledigt = idx // Schritte VOR dem aktuellen gelten als erledigt
  const verbleibend = Math.max(0, anzahl - idx)
  return {
    erledigt,
    prozent: anzahl === 0 ? 0 : Math.round((erledigt / anzahl) * 100),
    restMinuten: verbleibend === 0 ? 0 : Math.max(1, Math.round((verbleibend * SEKUNDEN_PRO_SCHRITT) / 60)),
    fertig: verbleibend === 0,
  }
}
