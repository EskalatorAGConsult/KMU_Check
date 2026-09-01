import { describe, expect, it } from 'vitest'

import { analysiereVerbund, classify, evaluateKmu, fundingRateFor, type CompanyInput, type Holding } from '@/lib/kmu'

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

describe('evaluateKmu – Beteiligungsketten (EU 2003/361/EG, Anhang Art. 6)', () => {
  const KETTE_BEZUG = 'Test GmbH'

  it('Kontrollkette aufwärts: Ober-Holding zählt transitiv zu 100 %', () => {
    // Holding --60 %--> Antragsteller; OberHolding --80 %--> Holding
    const r = evaluateKmu(
      basis({
        holdings: [
          holding(60, { name: 'Holding AG', employees: 40, turnover: 4_000_000, balanceSheet: 2_000_000 }),
          holding(80, {
            name: 'Ober-Holding SE',
            bezug: 'Holding AG',
            employees: 500,
            turnover: 90_000_000,
            balanceSheet: 70_000_000,
          }),
        ],
      }),
    )
    expect(r.linkedContribution.employees).toBe(540) // 40 + 500, beide voll
    expect(r.consolidated.employees).toBe(545)
    expect(r.category).toBe('gross')
    expect(r.reasons.some((t) => t.includes('Kontrollkette'))).toBe(true)
  })

  it('Kontrollkette abwärts: Enkel über Tochter transitiv zu 100 %', () => {
    // Antragsteller --55 %--> Tochter --100 %--> Enkel
    const r = evaluateKmu(
      basis({
        holdings: [
          holding(55, { name: 'Tochter GmbH', employees: 10, turnover: 0, balanceSheet: 0 }),
          holding(100, { name: 'Enkel GmbH', bezug: 'Tochter GmbH', employees: 20, turnover: 0, balanceSheet: 0 }),
        ],
      }),
    )
    expect(r.linkedContribution.employees).toBe(30)
    expect(r.consolidated.employees).toBe(35)
  })

  it('Partner-Konsolidation: mit Partner verbundene Firma zählt mit PARTNER-Quote, nicht 100 %', () => {
    // PartnerMutter --90 %--> Partner --30 %--> Antragsteller
    // EU Art. 6 Abs. 4: effektiv 30 % (nicht 100 %) für die PartnerMutter
    const r = evaluateKmu(
      basis({
        holdings: [
          holding(30, { name: 'Partner GmbH', employees: 100, turnover: 0, balanceSheet: 0 }),
          holding(90, { name: 'PartnerMutter GmbH', bezug: 'Partner GmbH', employees: 200, turnover: 0, balanceSheet: 0 }),
        ],
      }),
    )
    // 30 % × (100 + 200) = 90 JAE zugerechnet
    expect(r.partnerContribution.employees).toBeCloseTo(90)
    expect(r.linkedContribution.employees).toBe(0)
    expect(r.consolidated.employees).toBeCloseTo(95)
  })

  it('Mittelbare Partner (25–50 % in der Folgekette) werden NICHT verrechnet', () => {
    // Fern GmbH --40 %--> Holding AG --60 %--> Antragsteller
    const r = evaluateKmu(
      basis({
        holdings: [
          holding(60, { name: 'Holding AG', employees: 40, turnover: 0, balanceSheet: 0 }),
          holding(40, { name: 'Fern GmbH', bezug: 'Holding AG', employees: 999, turnover: 0, balanceSheet: 0 }),
        ],
      }),
    )
    expect(r.consolidated.employees).toBe(45) // nur eigene + Holding
  })

  it('Doppelte Anbindung: höchste Quote gewinnt, keine Doppelzählung', () => {
    // B ist direkter Partner (30 %) UND über A (100 %) mit Partner A verbunden
    const r = evaluateKmu(
      basis({
        holdings: [
          holding(30, { name: 'A GmbH', employees: 100, turnover: 0, balanceSheet: 0 }),
          holding(100, { name: 'B GmbH', bezug: 'A GmbH', employees: 50, turnover: 0, balanceSheet: 0 }),
          holding(30, { name: 'B GmbH', employees: 50, turnover: 0, balanceSheet: 0 }),
        ],
      }),
    )
    // B: max(30 % direkt, 30 % über A) = 30 % – einmalig
    expect(r.partnerContribution.employees).toBeCloseTo(100 * 0.3 + 50 * 0.3)
  })

  it('Kanten unter 25 % bleiben auch in Ketten ohne Wirkung', () => {
    const r = evaluateKmu(
      basis({
        holdings: [
          holding(20, { name: 'Klein GmbH', employees: 999 }),
          holding(90, { name: 'Dahinter GmbH', bezug: 'Klein GmbH', employees: 999 }),
        ],
      }),
    )
    expect(r.consolidated.employees).toBe(5)
  })

  it('analysiereVerbund liefert effektive Quoten und Tiefen für die Anzeige', () => {
    const zeilen = analysiereVerbund(KETTE_BEZUG, [
      holding(60, { name: 'Holding AG' }),
      holding(80, { name: 'Ober SE', bezug: 'Holding AG' }),
      holding(30, { name: 'Kompagnon GmbH' }),
      holding(40, { name: 'Fern GmbH', bezug: 'Holding AG' }),
    ])
    const nach = Object.fromEntries(zeilen.map((z) => [z.name, z]))
    expect(nach['Holding AG']).toMatchObject({ art: 'verbunden', effektivPct: 100, tiefe: 1 })
    expect(nach['Ober SE']).toMatchObject({ art: 'verbunden', effektivPct: 100, tiefe: 2 })
    expect(nach['Kompagnon GmbH']).toMatchObject({ art: 'partner', effektivPct: 30, tiefe: 1 })
    expect(nach['Fern GmbH']).toMatchObject({ art: 'ignoriert', effektivPct: 0 })
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
