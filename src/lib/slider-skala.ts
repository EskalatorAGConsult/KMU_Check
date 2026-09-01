/**
 * Skalen-Vertrag des Beteiligungsquote-Sliders (25–100 %): rechnet einen
 * Quotenwert in die Schienenposition (0–100 %) um. Rein, framework-frei.
 *
 * Hintergrund: Auf einer 25–100-Schiene liegt der Wert 50 NICHT in der
 * Mitte (das waere 62,5), sondern bei 33,3 %. Ticks/Marker duerfen daher
 * nie gleichmaessig verteilt (justify-between) gesetzt werden.
 */

export const SLIDER_MIN = 25
export const SLIDER_MAX = 100

/** Position eines Werts auf der Schiene in Prozent (0–100). */
export function schienenPosition(wert: number, min = SLIDER_MIN, max = SLIDER_MAX): number {
  return ((wert - min) / (max - min)) * 100
}

/** Markante Skalenpunkte des EU-Reglers, vorberechnet fuer das Layout. */
export const SKALA = {
  /** Wert 50 (EU-Kipppunkt Partner/verbunden) sitzt bei 33,3 % der Schiene. */
  kipppunkt50: schienenPosition(50),
  /** Mitten der EU-Zonen fuer die Zonen-Beschriftung. */
  zonePartner: schienenPosition((SLIDER_MIN + 50) / 2),
  zoneVerbunden: schienenPosition((50 + SLIDER_MAX) / 2),
} as const
