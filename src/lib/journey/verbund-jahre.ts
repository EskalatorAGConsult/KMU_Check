import type { Holding } from '@/lib/kmu'

import type { BeteiligungJahrDaten } from './schemas'

/**
 * Jahresbezogener Zugriff auf Beteiligungs-Kennzahlen – rein und framework-
 * frei (wie kmu.ts), deshalb voll testbar.
 *
 * Hintergrund: Das BAFA-Portal fragt die Kennzahlen der letzten zwei
 * abgeschlossenen Geschäftsjahre ab (2025 UND 2024) – auch für Partner- und
 * verbundene Unternehmen. Vor Migration 24 hatte jede Beteiligung nur EINEN
 * jahreslosen Kennzahlensatz; dieselben Zahlen flossen in die Verbundrechnung
 * BEIDER Jahre.
 *
 * Zwei Datenquellen, ein Zugriff:
 * - Journey-Drafts:  beteiligungSchema.jahre  (schemas.ts)
 * - DB-Zeilen:       beteiligungen.kennzahlen (types.ts, Migration 24)
 *
 * Fallback-Regel (Audit 02.09.2026): Die Skalarfelder gelten NUR für
 * Alt-Bestände OHNE Jahres-Array – niemals, wenn ein Array existiert und das
 * gefragte Jahr darin fehlt (sonst würden z. B. 2024er Registerwerte als
 * 2025er „erfunden" und ins BAFA-Portal übernommen). Skalarwerte können
 * Strings sein (alte UI speicherte input.value roh; Zod coerced serverseitig).
 */

/** Lockere Jahres-Kennzahl (deckt Drafts mit Strings UND DB-Rows mit null ab). */
interface JahresKennzahlRoh {
  geschaeftsjahr: number | string
  jae?: number | string | null
  umsatz?: number | string | null
  bilanzsumme?: number | string | null
}

/** Struktur, die Journey-Drafts (jahre) und DB-Zeilen (kennzahlen) erfüllt. */
export interface BeteiligungMitJahren {
  name?: string | null
  /** Journey-Draft: Jahres-Kennzahlen. */
  jahre?: readonly JahresKennzahlRoh[] | null
  /** DB-Zeile (Migration 24): Jahres-Kennzahlen. */
  kennzahlen?: readonly JahresKennzahlRoh[] | null
  jae?: number | string | null
  umsatz?: number | string | null
  bilanzsumme?: number | string | null
}

/** Roher Wert (number | string) → number | null (Komma-tolerant, NaN/negativ = null). */
function zuZahl(wert: unknown): number | null {
  if (typeof wert === 'number') return isFinite(wert) && wert >= 0 ? wert : null
  if (typeof wert === 'string') {
    let s = wert.trim()
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.') // deutsches Format (1.234,50)
    const n = Number(s)
    return isFinite(n) && n >= 0 ? n : null
  }
  return null
}

/** Das Jahres-Array dieser Beteiligung (Draft: jahre, DB: kennzahlen). */
function jahresArray(b: BeteiligungMitJahren): readonly JahresKennzahlRoh[] | null {
  const arr = Array.isArray(b.jahre) ? b.jahre : Array.isArray(b.kennzahlen) ? b.kennzahlen : null
  return arr && arr.length > 0 ? arr : null
}

/**
 * Kennzahlwert EINER Beteiligung für ein Geschäftsjahr.
 * Reihenfolge: jahrespassender Eintrag im Array → Skalar-Fallback (NUR wenn
 * gar kein Jahres-Array existiert, s. Kopf) → null.
 */
export function jahrKennzahl(
  b: BeteiligungMitJahren,
  geschaeftsjahr: number,
  feld: 'jae' | 'umsatz' | 'bilanzsumme',
): number | null {
  const arr = jahresArray(b)
  if (arr) {
    const eintrag = arr.find((j) => Number(j.geschaeftsjahr) === geschaeftsjahr)
    return eintrag ? zuZahl(eintrag[feld]) : null
  }
  return zuZahl(b[feld])
}

/** Holding-Eingabe der kmu.ts-Engine für GENAU ein Geschäftsjahr (jahrgemischt). */
export function holdingsFuerJahr<T extends BeteiligungMitJahren & {
  anteil_pct?: number | string | null
  bezug?: string | null
}>(beteiligungen: T[], geschaeftsjahr: number): Holding[] {
  return beteiligungen
    .filter((b) => b?.name && String(b.name).trim() !== '' && (zuZahl(b.anteil_pct) ?? 0) > 0)
    .map((b, i) => ({
      id: `b${i}`,
      name: String(b.name).trim(),
      sharePct: zuZahl(b.anteil_pct) ?? 0,
      employees: jahrKennzahl(b, geschaeftsjahr, 'jae') ?? 0,
      turnover: jahrKennzahl(b, geschaeftsjahr, 'umsatz') ?? 0,
      balanceSheet: jahrKennzahl(b, geschaeftsjahr, 'bilanzsumme') ?? 0,
      bezug: b.bezug?.trim() ? b.bezug.trim() : undefined,
    }))
}

/**
 * Vollständige jahre-Struktur für eine Beteiligung aufbauen/ergänzen:
 * Vorhandene Jahre-Einträge bleiben unangetastet; fehlende Jahre bleiben
 * LEER (kein Skalar-Erfindungs-Fallback – bewusste Audit-Entscheidung).
 * Nur Beteiligungen ohne jedes Jahres-Array erben beim ersten Schreiben die
 * Legacy-Skalarwerte in beide Jahre (Alt-Draft-Migration, sichtbar/editierbar).
 * Rückgabe ist Zod-kompatibel (BeteiligungJahrDaten, Roh-Strings erlaubt).
 */
export function jahreAufbauen(
  b: BeteiligungMitJahren,
  geschaeftsjahre: readonly number[],
): BeteiligungJahrDaten[] {
  const vorhanden = jahresArray(b)
  if (vorhanden) {
    return geschaeftsjahre.map((gj) => {
      const eintrag = vorhanden.find((j) => Number(j.geschaeftsjahr) === gj)
      return eintrag ? (eintrag as BeteiligungJahrDaten) : { geschaeftsjahr: gj }
    })
  }
  return geschaeftsjahre.map((gj) => ({
    geschaeftsjahr: gj,
    jae: zuZahl(b.jae) ?? undefined,
    umsatz: zuZahl(b.umsatz) ?? undefined,
    bilanzsumme: zuZahl(b.bilanzsumme) ?? undefined,
  }))
}
