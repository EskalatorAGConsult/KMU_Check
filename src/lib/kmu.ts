/**
 * KMU-Berechnung nach EU-Empfehlung 2003/361/EG (KMU-Definition der
 * Europäischen Kommission), wie sie u. a. für die BAFA-Förderung
 * "Energieeffizienz und Prozesswärme aus erneuerbaren Energien in der
 * Wirtschaft – Zuschuss (EEW)" / Modul 3 herangezogen wird.
 *
 * Schwellenwerte (es gilt: Mitarbeiterzahl IST bindend UND mindestens EINES
 * der beiden Finanzkriterien – Umsatz ODER Bilanzsumme – muss eingehalten sein):
 *
 *   Kategorie     | Beschäftigte (JAE) | Umsatz/Jahr   | Bilanzsumme
 *   --------------|--------------------|---------------|-------------
 *   Kleinst       | < 10               | ≤ 2 Mio. €    | ≤ 2 Mio. €
 *   Klein         | < 50               | ≤ 10 Mio. €   | ≤ 10 Mio. €
 *   Mittel        | < 250              | ≤ 50 Mio. €   | ≤ 43 Mio. €
 *   Großunternehmen (kein KMU): alles darüber
 *
 * Verbund-/Partnerlogik:
 *   - Partnerunternehmen (25 % bis 50 % Beteiligung): anteilige Zurechnung
 *     der Werte (z. B. 30 % Beteiligung => 30 % der Mitarbeiter/Umsatz/Bilanz).
 *   - Verbundene Unternehmen (> 50 % / Kontrolle): 100 %ige Zurechnung.
 *   - Beziehungen gelten in beide Richtungen (Beteiligungen, die das
 *     Unternehmen hält, UND Beteiligungen, die an dem Unternehmen gehalten
 *     werden).
 */

export type Category = 'kleinst' | 'klein' | 'mittel' | 'gross'

/** Eine Beteiligung im Verbund (auf- oder abwärts). */
export interface Holding {
  id: string
  name: string
  /** Beteiligungsquote in Prozent (0–100). Bestimmt Partner vs. verbunden. */
  sharePct: number
  /** Jahresarbeitseinheiten (Vollzeitäquivalente) des Beteiligungsunternehmens. */
  employees: number
  /** Jahresumsatz in € des Beteiligungsunternehmens. */
  turnover: number
  /** Bilanzsumme in € des Beteiligungsunternehmens. */
  balanceSheet: number
}

export interface CompanyInput {
  companyName: string
  /** Letztes abgeschlossenes/veröffentlichtes Geschäftsjahr (Bezugsjahr der Werte). */
  fiscalYear?: number
  /** Jahresarbeitseinheiten (Vollzeitäquivalente) des eigenen Unternehmens. */
  employees: number
  turnover: number
  balanceSheet: number
  holdings: Holding[]
}

export interface ConsolidatedTotals {
  employees: number
  turnover: number
  balanceSheet: number
}

export interface KmuResult {
  /** Eigene Werte (ohne Verbund). */
  own: ConsolidatedTotals
  /** Anteil aus Partnerunternehmen (25–50 %). */
  partnerContribution: ConsolidatedTotals
  /** Anteil aus verbundenen Unternehmen (> 50 %). */
  linkedContribution: ConsolidatedTotals
  /** Konsolidierte ("fiktive") Gesamtwerte des Verbunds. */
  consolidated: ConsolidatedTotals
  category: Category
  categoryLabel: string
  isKmu: boolean
  /** Förderquote BAFA Modul 3 in Prozent. */
  fundingRatePct: number
  /** Welches Kriterium ist limitierend / warum diese Einstufung? */
  reasons: string[]
  /** true, sobald mindestens ein Schwellenwert knapp (>= 90 %) erreicht ist. */
  nearThreshold: boolean
}

export const EMPTY_TOTALS: ConsolidatedTotals = { employees: 0, turnover: 0, balanceSheet: 0 }

const THRESHOLDS = {
  kleinst: { employees: 10, turnover: 2_000_000, balanceSheet: 2_000_000 },
  klein: { employees: 50, turnover: 10_000_000, balanceSheet: 10_000_000 },
  mittel: { employees: 250, turnover: 50_000_000, balanceSheet: 43_000_000 },
} as const

export const CATEGORY_LABELS: Record<Category, string> = {
  kleinst: 'Kleinstunternehmen',
  klein: 'Kleines Unternehmen',
  mittel: 'Mittleres Unternehmen',
  gross: 'Großunternehmen (kein KMU)',
}

/** Förderquote (BAFA Modul 3): Klein/Kleinst 45 %, Mittel 35 %, kein KMU 25 %. */
export function fundingRateFor(category: Category): number {
  switch (category) {
    case 'kleinst':
    case 'klein':
      return 45
    case 'mittel':
      return 35
    case 'gross':
    default:
      return 25
  }
}

function num(v: number | undefined | null): number {
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0
}

/** Klassifiziert ein Unternehmen anhand der konsolidierten Werte. */
export function classify(totals: ConsolidatedTotals): { category: Category; reasons: string[] } {
  const { employees, turnover, balanceSheet } = totals
  const reasons: string[] = []

  // Mitarbeiterzahl ist bindend (strikt kleiner als Schwellenwert).
  // Finanzkriterium: Umsatz ODER Bilanzsumme innerhalb der Grenze genügt.
  const financialWithin = (t: { turnover: number; balanceSheet: number }) =>
    turnover <= t.turnover || balanceSheet <= t.balanceSheet

  if (employees < THRESHOLDS.kleinst.employees && financialWithin(THRESHOLDS.kleinst)) {
    reasons.push('Unter 10 Jahresarbeitseinheiten und Umsatz oder Bilanzsumme ≤ 2 Mio. €.')
    return { category: 'kleinst', reasons }
  }
  if (employees < THRESHOLDS.klein.employees && financialWithin(THRESHOLDS.klein)) {
    reasons.push('Unter 50 Jahresarbeitseinheiten und Umsatz oder Bilanzsumme ≤ 10 Mio. €.')
    return { category: 'klein', reasons }
  }
  if (employees < THRESHOLDS.mittel.employees && financialWithin(THRESHOLDS.mittel)) {
    reasons.push('Unter 250 Jahresarbeitseinheiten und Umsatz ≤ 50 Mio. € oder Bilanzsumme ≤ 43 Mio. €.')
    return { category: 'mittel', reasons }
  }

  // Begründung, warum kein KMU.
  if (employees >= THRESHOLDS.mittel.employees) {
    reasons.push(`Mit ${Math.round(employees)} Jahresarbeitseinheiten wird die Grenze von 250 erreicht oder überschritten.`)
  }
  if (turnover > THRESHOLDS.mittel.turnover && balanceSheet > THRESHOLDS.mittel.balanceSheet) {
    reasons.push('Sowohl Umsatz (> 50 Mio. €) als auch Bilanzsumme (> 43 Mio. €) liegen über den KMU-Grenzen.')
  }
  return { category: 'gross', reasons }
}

/** Berechnet anteilige/100 %ige Verbundbeiträge und die Gesamteinstufung. */
export function evaluateKmu(input: CompanyInput): KmuResult {
  const own: ConsolidatedTotals = {
    employees: num(input.employees),
    turnover: num(input.turnover),
    balanceSheet: num(input.balanceSheet),
  }

  const partnerContribution = { ...EMPTY_TOTALS }
  const linkedContribution = { ...EMPTY_TOTALS }

  for (const h of input.holdings) {
    const share = num(h.sharePct)
    if (share < 25) continue // Beteiligungen < 25 % bleiben unberücksichtigt.
    const e = num(h.employees)
    const t = num(h.turnover)
    const b = num(h.balanceSheet)

    if (share > 50) {
      // Verbundenes Unternehmen -> 100 % Zurechnung.
      linkedContribution.employees += e
      linkedContribution.turnover += t
      linkedContribution.balanceSheet += b
    } else {
      // Partnerunternehmen (25–50 %) -> anteilige Zurechnung.
      const factor = share / 100
      partnerContribution.employees += e * factor
      partnerContribution.turnover += t * factor
      partnerContribution.balanceSheet += b * factor
    }
  }

  const consolidated: ConsolidatedTotals = {
    employees: own.employees + partnerContribution.employees + linkedContribution.employees,
    turnover: own.turnover + partnerContribution.turnover + linkedContribution.turnover,
    balanceSheet: own.balanceSheet + partnerContribution.balanceSheet + linkedContribution.balanceSheet,
  }

  const { category, reasons } = classify(consolidated)
  const isKmu = category !== 'gross'
  const fundingRatePct = fundingRateFor(category)

  // Nähe zum nächsthöheren Schwellenwert (für UX-Hinweise / Visualisierung).
  const nextEmpThreshold =
    category === 'kleinst' ? 10 : category === 'klein' ? 50 : category === 'mittel' ? 250 : 250
  const nearThreshold = consolidated.employees >= nextEmpThreshold * 0.9

  return {
    own,
    partnerContribution,
    linkedContribution,
    consolidated,
    category,
    categoryLabel: CATEGORY_LABELS[category],
    isKmu,
    fundingRatePct,
    reasons,
    nearThreshold,
  }
}

/** Formatierungshelfer. */
export function formatEUR(v: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Math.round(v || 0))
}

export function formatNumber(v: number, digits = 0): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }).format(v || 0)
}
