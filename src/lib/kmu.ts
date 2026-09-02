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
 * Verbund-/Partnerlogik (Anhang Art. 6, beliebig tiefe Beteiligungsketten):
 *   - Verbundene Unternehmen (> 50 % / Kontrolle): 100 %ige Zurechnung,
 *     TRANSITIV ueber Kontrollketten in beide Richtungen (z. B. haelt eine
 *     Holding 60 % am Antragsteller und eine Ober-Holding 80 % an der
 *     Holding, zaehlt auch die Ober-Holding voll).
 *   - Partnerunternehmen (25–50 %, nur DIREKT am Antragsteller): anteilige
 *     Zurechnung der KONSOLIDIERTEN Daten des Partners – d. h. inklusive
 *     100 % der mit dem Partner verbundenen Unternehmen, dann mal Quote.
 *   - Mittelbare Partner (25–50 % in der Folgekette): nicht verrechnungspflichtig.
 *   - Doppelzaehlungen werden vermieden (pro Unternehmen hoechste Quote;
 *     verbunden schlaegt Partner). Ketten werden ueber das optionale Feld
 *     `bezug` (Bezugsunternehmen der Kante) abgebildet.
 *   - Beziehungen gelten in beide Richtungen (Beteiligungen, die das
 *     Unternehmen hält, UND Beteiligungen, die an dem Unternehmen gehalten
 *     werden).
 */

export type Category = 'kleinst' | 'klein' | 'mittel' | 'gross'

/** Eine Beteiligung im Verbund (auf- oder abwärts, ggf. über Zwischengesellschaften). */
export interface Holding {
  id: string
  name: string
  /** Beteiligungsquote in Prozent (0–100) – immer die DIREKTE Quote der Kante. */
  sharePct: number
  /** Jahresarbeitseinheiten (Vollzeitäquivalente) des Beteiligungsunternehmens. */
  employees: number
  /** Jahresumsatz in € des Beteiligungsunternehmens. */
  turnover: number
  /** Bilanzsumme in € des Beteiligungsunternehmens. */
  balanceSheet: number
  /**
   * Bezugsunternehmen der Kante (Name). Standard: der Antragsteller selbst.
   * Ermöglicht Ketten beliebiger Tiefe, z. B. „Holding hält 80 % an Mutter"
   * (bezug = 'Mutter GmbH'), ohne dass die 2. Stufe direkt am Antragsteller hängt.
   */
  bezug?: string
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

/**
 * Eine Beteiligungskante zwischen zwei Unternehmen (Richtung ist fuer die
 * EU-Verrechnung egal – Kontrolle wirkt in beide Richtungen).
 */
interface Kante {
  /** Bezugsunternehmen (die eine Seite der Kante). */
  von: string
  /** Das gemeldete Beteiligungsunternehmen (die andere Seite). */
  nach: string
  /** Direkte Quote der Kante in Prozent. */
  pct: number
}

/**
 * Transitiver Kontroll-Schluss (EU 2003/361/EG, Anhang Art. 3 Abs. 3 und
 * Art. 6 Abs. 2): ueber Kanten mit > 50 % in BEIDE Richtungen, beliebig tief.
 * Wer ein verbundenes Unternehmen kontrolliert (oder von ihm kontrolliert
 * wird), ist selbst verbunden. Zyklenfest ueber `besucht`.
 */
function kontrollSchluss(start: string, kanten: Kante[], ausgeschlossen: Set<string>): Map<string, number> {
  // Wert = Kettentiefe (1 = direkt) fuer die Begruendungstexte
  const besucht = new Map<string, number>()
  const queue: { name: string; tiefe: number }[] = [{ name: start, tiefe: 0 }]
  while (queue.length > 0) {
    const { name, tiefe } = queue.shift() as { name: string; tiefe: number }
    for (const e of kanten) {
      if (e.pct <= 50) continue
      let next: string | null = null
      if (e.von === name) next = e.nach
      else if (e.nach === name) next = e.von
      if (!next || next === name || besucht.has(next) || ausgeschlossen.has(next)) continue
      besucht.set(next, tiefe + 1)
      queue.push({ name: next, tiefe: tiefe + 1 })
    }
  }
  return besucht
}

/**
 * Klassifiziert alle Beteiligungen EU-konform und liefert je Unternehmen die
 * EFFEKTIVE Verrechnungsquote (0–100) – die zentrale, wiederverwendbare
 * Verbund-Analyse fuer Journey, Landingpage-Tool und Admin-Darstellung.
 *
 * Regeln (EU 2003/361/EG, Anhang Art. 6):
 * - verbunden (> 50 %, transitiv ueber Kontrollketten): 100 %
 * - Partner (25–50 %, nur DIREKT am Antragsteller): Quote × konsolidierte
 *   Daten des Partners (d. h. inkl. 100 % der mit ihm verbundenen Unternehmen)
 * - Partner eines VERBUNDENEN Unternehmens (25–50 % am Verbundenen): zaehlen
 *   mit ihrer direkten Quote in die Daten des Verbundenen, das selbst zu
 *   100 % zaehlt (Art. 6 Abs. 2) – war frueher faelschlich „ignoriert"
 *   (Audit-Finding HIGH).
 * - mittelbare Partner (25–50 % an einem PARTNER, nicht am Verbundenen):
 *   nicht verrechnungspflichtig
 * - Doppelzaehlungen werden vermieden (pro Unternehmen zaehlt die hoechste
 *   ermittelte Quote, verbunden schlaegt Partner).
 */
export interface VerbundZeile {
  name: string
  /** Bezugsunternehmen der direkten Kante (Anzeige/Kette). */
  bezug: string
  /** Direkte Quote der Kante in Prozent. */
  pct: number
  /** Effektive Verrechnungsquote (0 = nicht verrechnungspflichtig). */
  effektivPct: number
  /** Kettentiefe (1 = direkt am Antragsteller). */
  tiefe: number
  art: 'verbunden' | 'partner' | 'ignoriert'
  /** Kurzbegruendung fuer UI/PDF. */
  grund: string
}

export function analysiereVerbund(companyName: string, holdings: Holding[]): VerbundZeile[] {
  const applicant = companyName.trim() || 'Antragsteller'
  // Knoten deduplizieren (erste Angabe gewinnt), Kanten sammeln (max. Quote je Paar)
  const kantenMap = new Map<string, Kante>()
  const reihenfolge: string[] = []
  const bezugVon = new Map<string, string>()
  for (const h of holdings) {
    const pct = num(h.sharePct)
    const name = h.name.trim()
    if (!name || name === applicant || pct <= 0) continue
    const von = h.bezug?.trim() || applicant
    if (!bezugVon.has(name)) {
      bezugVon.set(name, von)
      reihenfolge.push(name)
    }
    const key = [von, name].sort().join('⇔')
    const bestehend = kantenMap.get(key)
    if (!bestehend || pct > bestehend.pct) kantenMap.set(key, { von, nach: name, pct })
  }
  const kanten = [...kantenMap.values()].filter((e) => e.pct >= 25)

  // 1 · Kontroll-Schluss ab Antragsteller (verbunden, transitiv, 100 %)
  const linked = kontrollSchluss(applicant, kanten, new Set())

  // 2 · Direkte Partner (25–50 %, Kante am Antragsteller, nicht verbunden)
  const partnerPct = new Map<string, number>()
  for (const e of kanten) {
    const istDirekt = e.von === applicant || e.nach === applicant
    if (!istDirekt || e.pct < 25 || e.pct > 50) continue
    const name = e.von === applicant ? e.nach : e.von
    if (linked.has(name)) continue
    partnerPct.set(name, Math.max(partnerPct.get(name) ?? 0, e.pct))
  }

  // 2b · Partner VERBUNDENER Unternehmen (25–50 % an einem Verbundenen):
  // Ihre Daten zaehlen mit der DIREKTEN Quote in die konsolidierten Daten
  // des Verbundenen (der selbst zu 100 % zaehlt) – EU Anhang Art. 6 Abs. 2.
  // Ausgeschlossen: Antragsteller, Verbundene (zaehlen eh 100 %) und direkte
  // Partner des Antragstellers (zaehlen bereits ueber Schritt 2).
  const partnerVonLinked = new Map<string, { pct: number; ueber: string }>()
  for (const e of kanten) {
    if (e.pct < 25 || e.pct > 50) continue
    const verbundeneSeite = linked.has(e.von) ? e.von : linked.has(e.nach) ? e.nach : null
    if (!verbundeneSeite) continue
    const name = e.von === verbundeneSeite ? e.nach : e.von
    if (name === applicant || linked.has(name) || partnerPct.has(name)) continue
    const b = partnerVonLinked.get(name)
    if (!b || e.pct > b.pct) partnerVonLinked.set(name, { pct: e.pct, ueber: verbundeneSeite })
  }

  // 3 · Partner-Konsolidation: mit einem Partner verbundene Unternehmen zaehlen
  // mit der Quote des PARTNERS (nicht 100 %) – Doppelzaehlung via Max-Prinzip.
  const effektiv = new Map<string, { pct: number; grund: string }>()
  const auschlussBasis = new Set<string>([applicant, ...linked.keys()])
  for (const [partner, pct] of partnerPct) {
    effektiv.set(partner, { pct, grund: `Partnerunternehmen – anteilige Verrechnung (${pct} %).` })
    const sub = kontrollSchluss(partner, kanten, new Set([...auschlussBasis, ...partnerPct.keys()]))
    for (const [name] of sub) {
      const b = effektiv.get(name)
      if (!b || b.pct < pct) {
        effektiv.set(name, {
          pct,
          grund: `Mit „${partner}" verbunden – zaehlt ueber den Partner anteilig mit (effektiv ${pct} %).`,
        })
      }
    }
  }

  // 3b · Partner verbundener Unternehmen einmischen (Max-Prinzip gegen
  // Partner-Konsolidation; verbunden schlaegt beides – schon ausgeschlossen).
  for (const [name, info] of partnerVonLinked) {
    const b = effektiv.get(name)
    if (!b || b.pct < info.pct) {
      effektiv.set(name, {
        pct: info.pct,
        grund: `Partner des verbundenen Unternehmens „${info.ueber}“ – zaehlt ueber dieses anteilig mit (effektiv ${info.pct} %).`,
      })
    }
  }

  // 4 · Tiefen fuer die Darstellung (ueber beliebige Kanten ab Antragsteller)
  const tiefe = new Map<string, number>()
  const queue: { name: string; t: number }[] = [{ name: applicant, t: 0 }]
  const alleKanten = kanten
  while (queue.length > 0) {
    const { name, t } = queue.shift() as { name: string; t: number }
    for (const e of alleKanten) {
      let next: string | null = null
      if (e.von === name) next = e.nach
      else if (e.nach === name) next = e.von
      if (!next || tiefe.has(next) || next === name) continue
      tiefe.set(next, t + 1)
      queue.push({ name: next, t: t + 1 })
    }
  }

  return reihenfolge.map((name) => {
    const pct = kanten.filter((e) => e.von === name || e.nach === name).reduce((m, e) => Math.max(m, e.pct), 0)
    const bezug = bezugVon.get(name) ?? applicant
    const t = tiefe.get(name) ?? 1
    if (linked.has(name)) {
      return {
        name,
        bezug,
        pct,
        effektivPct: 100,
        tiefe: linked.get(name) ?? t,
        art: 'verbunden' as const,
        grund:
          (linked.get(name) ?? 1) > 1
            ? 'Ueber eine Kontrollkette verbunden – volle Verrechnung (100 %).'
            : 'Verbundenes Unternehmen (> 50 %) – volle Verrechnung (100 %).',
      }
    }
    const p = effektiv.get(name)
    if (p) {
      return { name, bezug, pct, effektivPct: p.pct, tiefe: t, art: 'partner' as const, grund: p.grund }
    }
    return {
      name,
      bezug,
      pct,
      effektivPct: 0,
      tiefe: t,
      art: 'ignoriert' as const,
      grund:
        pct < 25
          ? 'Unter 25 % – nicht verrechnungspflichtig.'
          : 'Nur mittelbare Beteiligung (25–50 %) in der Folgekette – nicht verrechnungspflichtig.',
    }
  })
}

/** Berechnet anteilige/100 %ige Verbundbeiträge und die Gesamteinstufung. */
export function evaluateKmu(input: CompanyInput): KmuResult {
  const applicant = input.companyName.trim() || 'Antragsteller'
  const own: ConsolidatedTotals = {
    employees: num(input.employees),
    turnover: num(input.turnover),
    balanceSheet: num(input.balanceSheet),
  }

  // Daten je Unternehmen (erste Angabe gewinnt bei Dubletten)
  const daten = new Map<string, ConsolidatedTotals>()
  for (const h of input.holdings) {
    const name = h.name.trim()
    if (!name || name === applicant || daten.has(name)) continue
    daten.set(name, {
      employees: num(h.employees),
      turnover: num(h.turnover),
      balanceSheet: num(h.balanceSheet),
    })
  }

  const analyse = analysiereVerbund(applicant, input.holdings)
  const partnerContribution = { ...EMPTY_TOTALS }
  const linkedContribution = { ...EMPTY_TOTALS }
  const chainReasons: string[] = []

  for (const z of analyse) {
    const d = daten.get(z.name)
    if (!d || z.effektivPct === 0) continue
    if (z.art === 'verbunden') {
      linkedContribution.employees += d.employees
      linkedContribution.turnover += d.turnover
      linkedContribution.balanceSheet += d.balanceSheet
      if (z.tiefe > 1) chainReasons.push(`„${z.name}“ ist ueber eine Kontrollkette verbunden und zaehlt zu 100 %.`)
    } else {
      const f = z.effektivPct / 100
      partnerContribution.employees += d.employees * f
      partnerContribution.turnover += d.turnover * f
      partnerContribution.balanceSheet += d.balanceSheet * f
      if (z.grund.includes('ueber den Partner') || z.grund.includes('verbundenen Unternehmens')) {
        chainReasons.push(`„${z.name}“ ${z.grund}`)
      }
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
    reasons: [...chainReasons, ...reasons],
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
