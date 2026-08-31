import { describe, expect, it } from 'vitest'

import { classify, evaluateKmu, fundingRateFor, type CompanyInput, type Holding } from '@/lib/kmu'

/**
 * Tests der KMU-Engine gegen die Schwellenwerte der EU-Empfehlung 2003/361/EG.
 * Mitarbeiterzahl (JAE) ist bindend (strikt „kleiner als"), beim
 * Finanzkriterium genuegt Umsatz ODER Bilanzsumme.
 */

function basis(ueber?: Partial<CompanyInput>): CompanyInput {
  return {
    companyName: 'Test GmbH',
    employees: 5,
    turnover: 1_000_000,
    balanceSheet: 800_000,
    holdings: [],
    ...ueber,
  }
}

function holding(sharePct: number, werte?: Partial<Holding>): Holding {
  return {
    id: `h${sharePct}`,
    name: `Beteiligung ${sharePct}`,
    sharePct,
    employees: 100,
    turnover: 20_000_000,
    balanceSheet: 15_000_000,
    ...werte,
  }
}

describe('classify – Schwellenwerte EU 2003/361/EG', () => {
  it('9 JAE + ≤ 2 Mio. → kleinst', () => {
    expect(classify({ employees: 9, turnover: 2_000_000, balanceSheet: 2_000_000 }).category).toBe('kleinst')
  })

  it('10 JAE ist NICHT mehr kleinst (strikt kleiner als 10)', () => {
    expect(classify({ employees: 10, turnover: 2_000_000, balanceSheet: 2_000_000 }).category).toBe('klein')
  })

  it('49 JAE → klein, 50 JAE → mittel', () => {
    expect(classify({ employees: 49, turnover: 10_000_000, balanceSheet: 10_000_000 }).category).toBe('klein')
    expect(classify({ employees: 50, turnover: 10_000_000, balanceSheet: 10_000_000 }).category).toBe('mittel')
  })

  it('249 JAE → mittel, 250 JAE → gross (Mitarbeiterzahl bindend)', () => {
    expect(classify({ employees: 249, turnover: 50_000_000, balanceSheet: 43_000_000 }).category).toBe('mittel')
    expect(classify({ employees: 250, turnover: 1_000_000, balanceSheet: 1_000_000 }).category).toBe('gross')
  })

  it('Finanzkriterium: Umsatz ODER Bilanzsumme genuegt', () => {
    // Umsatz ueber 50 Mio., aber Bilanzsumme innerhalb 43 Mio. → weiterhin mittel
    expect(classify({ employees: 100, turnover: 60_000_000, balanceSheet: 40_000_000 }).category).toBe('mittel')
    // beide ueber den Grenzen → gross
    expect(classify({ employees: 100, turnover: 60_000_000, balanceSheet: 50_000_000 }).category).toBe('gross')
  })
})

describe('evaluateKmu – Verbund-Verrechnung', () => {
  it('Beteiligungen unter 25 % werden ignoriert', () => {
    const r = evaluateKmu(basis({ holdings: [holding(20)] }))
    expect(r.consolidated.employees).toBe(5)
    expect(r.category).toBe('kleinst')
  })

  it('Partner (25–50 %) werden anteilig zugerechnet', () => {
    const r = evaluateKmu(basis({ holdings: [holding(50, { employees: 40, turnover: 4_000_000, balanceSheet: 2_000_000 })] }))
    expect(r.partnerContribution.employees).toBe(20) // 50 % von 40
    expect(r.consolidated.employees).toBe(25)
    expect(r.consolidated.turnover).toBe(3_000_000)
    expect(r.category).toBe('klein')
  })

  it('Verbundene (> 50 %) werden zu 100 % zugerechnet', () => {
    const r = evaluateKmu(basis({ holdings: [holding(60, { employees: 40, turnover: 4_000_000, balanceSheet: 2_000_000 })] }))
    expect(r.linkedContribution.employees).toBe(40)
    expect(r.consolidated.employees).toBe(45)
    expect(r.category).toBe('klein')
  })

  it('Verbund kann die Einstufung auf gross kippen', () => {
    const r = evaluateKmu(basis({ holdings: [holding(100, { employees: 300, turnover: 0, balanceSheet: 0 })] }))
    expect(r.consolidated.employees).toBe(305)
    expect(r.category).toBe('gross')
    expect(r.isKmu).toBe(false)
  })
})

describe('fundingRateFor – Förderquote BAFA Modul 3', () => {
  it('kleinst/klein 45 %, mittel 35 %, gross 25 %', () => {
    expect(fundingRateFor('kleinst')).toBe(45)
    expect(fundingRateFor('klein')).toBe(45)
    expect(fundingRateFor('mittel')).toBe(35)
    expect(fundingRateFor('gross')).toBe(25)
  })

  it('evaluateKmu liefert die passende Quote mit', () => {
    expect(evaluateKmu(basis()).fundingRatePct).toBe(45)
    expect(evaluateKmu(basis({ employees: 100, turnover: 20_000_000, balanceSheet: 10_000_000 })).fundingRatePct).toBe(35)
  })
})
