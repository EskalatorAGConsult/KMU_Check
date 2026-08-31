import { describe, expect, it } from 'vitest'

import type { OrHolding, OrIndikator, OrOwner, OrSuchTreffer } from './client'
import {
  analysiereVerbundKette,
  kennzahlenAusIndikatoren,
  mapTreffer,
  rechtsformLabel,
  type Rohdaten,
} from './mapping'

/**
 * OpenRegister-Mapping: Cent->Euro, Geschaeftsjahr-Sortierung und vor allem die
 * REKURSIVE EU-Verbundlogik (2003/361/EG): verbunden (> 50 %) wirkt transitiv
 * ueber beliebig viele Stufen; Partner (25–50 %) nur direkt; mit einem Partner
 * verbundene Unternehmen zaehlen wieder voll.
 */

// ---------- Fixtures ----------

function roh(
  name: string,
  opts: { owners?: OrOwner[]; holdings?: OrHolding[]; indicators?: OrIndikator[] } = {},
): Rohdaten {
  return {
    details: { id: name, name: { name }, address: null, indicators: opts.indicators ?? [] },
    owners: opts.owners ?? [],
    holdings: opts.holdings ?? [],
  }
}

const owner = (id: string, name: string, pct: number): OrOwner => ({
  id,
  name,
  type: 'legal_person',
  legal_person: { name },
  percentage_share: pct,
})

const holding = (id: string, name: string, pct: number): OrHolding => ({
  company_id: id,
  name,
  percentage_share: pct,
  end: null,
})

const START = 'DE-HRB-A-1'

// ---------- Basis-Mapping ----------

describe('rechtsformLabel', () => {
  it('kennt gängige Rechtsformen', () => {
    expect(rechtsformLabel('gmbh')).toBe('GmbH')
    expect(rechtsformLabel('ag')).toBe('AG')
    expect(rechtsformLabel(null)).toBeNull()
    expect(rechtsformLabel('xyz')).toBe('XYZ')
  })
})

describe('mapTreffer', () => {
  it('mappt Autocomplete-Ergebnisse inkl. Register-Label', () => {
    const rohTreffer: OrSuchTreffer[] = [
      {
        company_id: 'DE-HRB-T2214-1054',
        name: 'Maschinen- und Behälterbau GmbH',
        legal_form: 'gmbh',
        active: true,
        address: { formatted_value: 'Betzdorfer Straße 170, 57567 Daaden' },
        register_court: 'Montabaur',
        register_type: 'HRB',
        register_number: '1054',
      },
    ]
    const [t] = mapTreffer(rohTreffer)
    expect(t.companyId).toBe('DE-HRB-T2214-1054')
    expect(t.rechtsform).toBe('GmbH')
    expect(t.registerLabel).toBe('HRB 1054 · Montabaur')
    expect(t.adresse).toContain('Daaden')
  })
})

describe('kennzahlenAusIndikatoren', () => {
  const indikatoren = [
    { date: '2023-12-31', employees: 43, revenue: null, balance_sheet_total: 245_173_333 },
    { date: '2024-12-31', employees: 44, revenue: 5_000_000_00, balance_sheet_total: 228_381_150 },
    { date: '2022-12-31', employees: 43, revenue: null, balance_sheet_total: 290_425_471 },
  ]

  it('sortiert neueste zuerst und rechnet Cent in Euro um', () => {
    const jahre = kennzahlenAusIndikatoren(indikatoren)
    expect(jahre.map((j) => j.geschaeftsjahr)).toEqual([2024, 2023])
    expect(jahre[0].bilanzsumme).toBe(2_283_812)
    expect(jahre[0].umsatz).toBe(5_000_000)
    expect(jahre[0].jae).toBe(44)
  })

  it('lässt fehlende Werte leer statt 0', () => {
    expect(kennzahlenAusIndikatoren(indikatoren)[1].umsatz).toBeUndefined()
  })

  it('toleriert leere/fehlende Indikatoren', () => {
    expect(kennzahlenAusIndikatoren(null)).toEqual([])
  })
})

// ---------- Kettenlogik ----------

describe('analysiereVerbundKette – Stufe 1 (direkt)', () => {
  it('klassifiziert direkte Gesellschafter aufwärts und Beteiligungen abwärts', () => {
    const graph: Record<string, Rohdaten> = {
      [START]: roh('Antragsteller GmbH', {
        owners: [owner('X', 'Mutter GmbH', 100), owner('P', 'Kompagnon GmbH', 30)],
        holdings: [holding('T', 'Tochter GmbH', 60)],
        indicators: [{ date: '2024-12-31', employees: 44, revenue: null, balance_sheet_total: 228_381_150 }],
      }),
      X: roh('Mutter GmbH', { indicators: [{ date: '2024-12-31', employees: 120, revenue: 10_000_000_00, balance_sheet_total: 8_000_000_00 }] }),
      P: roh('Kompagnon GmbH'),
      T: roh('Tochter GmbH'),
    }
    const { ergebnis, fehlendeIds } = analysiereVerbundKette(graph, START)
    expect(fehlendeIds).toEqual([])
    expect(ergebnis.beteiligungen).toHaveLength(3)

    const mutter = ergebnis.beteiligungen.find((b) => b.registerId === 'X')
    expect(mutter).toMatchObject({ klasse: 'verbunden', anteil_pct: 100, richtung: 'aufwaerts', stufe: 1, jae: 120, umsatz: 10_000_000 })

    const kompagnon = ergebnis.beteiligungen.find((b) => b.registerId === 'P')
    expect(kompagnon).toMatchObject({ klasse: 'partner', anteil_pct: 30, stufe: 1 })

    const tochter = ergebnis.beteiligungen.find((b) => b.registerId === 'T')
    expect(tochter).toMatchObject({ klasse: 'verbunden', anteil_pct: 100, richtung: 'abwaerts', stufe: 1 })

    // Eigene Kennzahlen + Stammdaten
    expect(ergebnis.jahre[0]).toMatchObject({ geschaeftsjahr: 2024, jae: 44 })
  })

  it('verschiebt Beteiligungen unter 25 % in die Ignorieren-Liste', () => {
    const graph = { [START]: roh('A', { owners: [owner('K', 'Klein GmbH', 10)] }) }
    const { ergebnis } = analysiereVerbundKette(graph, START)
    expect(ergebnis.beteiligungen).toHaveLength(0)
    expect(ergebnis.ignoriert[0]).toMatchObject({ name: 'Klein GmbH', anteil_pct: 10 })
  })

  it('zählt natürliche Personen, ohne sie zu verrechnen', () => {
    const graph = {
      [START]: roh('A', { owners: [{ name: 'Max Mustermann', type: 'natural_person', percentage_share: 100 }] }),
    }
    const { ergebnis } = analysiereVerbundKette(graph, START)
    expect(ergebnis.beteiligungen).toHaveLength(0)
    expect(ergebnis.natuerlichePersonen).toBe(1)
  })
})

describe('analysiereVerbundKette – Folgestufen (Folgeketten)', () => {
  it('verfolgt Mehrheitsketten aufwärts transitiv (Stufe 2+)', () => {
    // Y --80 %--> X --60 %--> Antragsteller
    const graph: Record<string, Rohdaten> = {
      [START]: roh('Antragsteller GmbH', { owners: [owner('X', 'Mutter GmbH', 60)] }),
      X: roh('Mutter GmbH', { owners: [owner('Y', 'Holding GmbH', 80)] }),
      Y: roh('Holding GmbH', { indicators: [{ date: '2024-12-31', employees: 500, revenue: 90_000_000_00, balance_sheet_total: 70_000_000_00 }] }),
    }
    const { ergebnis } = analysiereVerbundKette(graph, START)
    const holdingGmbh = ergebnis.beteiligungen.find((b) => b.registerId === 'Y')
    expect(holdingGmbh).toMatchObject({
      klasse: 'verbunden',
      anteil_pct: 100,
      anteil_direkt_pct: 80,
      stufe: 2,
      richtung: 'aufwaerts',
      pfad: 'Holding GmbH hält 80 % an Mutter GmbH',
      jae: 500,
    })
  })

  it('verfolgt Mehrheitsketten abwärts transitiv', () => {
    // Antragsteller --55 %--> S --100 %--> T
    const graph: Record<string, Rohdaten> = {
      [START]: roh('Antragsteller GmbH', { holdings: [holding('S', 'Stufe1 GmbH', 55)] }),
      S: roh('Stufe1 GmbH', { holdings: [holding('T', 'Stufe2 GmbH', 100)] }),
      T: roh('Stufe2 GmbH'),
    }
    const { ergebnis } = analysiereVerbundKette(graph, START)
    const t = ergebnis.beteiligungen.find((b) => b.registerId === 'T')
    expect(t).toMatchObject({ klasse: 'verbunden', stufe: 2, richtung: 'abwaerts', anteil_pct: 100 })
  })

  it('Partner (25–50 %) nur direkt; mit Partner verbundene Firmen zählen voll', () => {
    // P --30 %--> Antragsteller (Partner); Q --90 %--> P (mit Partner verbunden -> 100 %)
    const graph: Record<string, Rohdaten> = {
      [START]: roh('Antragsteller GmbH', { owners: [owner('P', 'Partner GmbH', 30)] }),
      P: roh('Partner GmbH', { owners: [owner('Q', 'PartnerMutter GmbH', 90)] }),
      Q: roh('PartnerMutter GmbH'),
    }
    const { ergebnis } = analysiereVerbundKette(graph, START)
    const q = ergebnis.beteiligungen.find((b) => b.registerId === 'Q')
    expect(q).toMatchObject({ klasse: 'verbunden', anteil_pct: 100, stufe: 2 })
  })

  it('Partner von Partnern werden NICHT verrechnet', () => {
    // P --30 %--> Antragsteller (Partner); R --40 %--> P (nur Partner des Partners -> ignorieren)
    const graph: Record<string, Rohdaten> = {
      [START]: roh('Antragsteller GmbH', { owners: [owner('P', 'Partner GmbH', 30)] }),
      P: roh('Partner GmbH', { owners: [owner('R', 'Fern GmbH', 40)] }),
      R: roh('Fern GmbH'),
    }
    const { ergebnis } = analysiereVerbundKette(graph, START)
    expect(ergebnis.beteiligungen.some((b) => b.registerId === 'R')).toBe(false)
    expect(ergebnis.ignoriert.some((i) => i.name === 'Fern GmbH')).toBe(true)
  })

  it('Partner von verbundenen Unternehmen werden NICHT verrechnet', () => {
    // Antragsteller --60 %--> B (verbunden); B --30 %--> C (Partner des Verbundenen -> ignorieren)
    const graph: Record<string, Rohdaten> = {
      [START]: roh('Antragsteller GmbH', { holdings: [holding('B', 'Tochter GmbH', 60)] }),
      B: roh('Tochter GmbH', { holdings: [holding('C', 'Enkel-Beteiligung GmbH', 30)] }),
      C: roh('Enkel-Beteiligung GmbH'),
    }
    const { ergebnis } = analysiereVerbundKette(graph, START)
    expect(ergebnis.beteiligungen.some((b) => b.registerId === 'C')).toBe(false)
  })

  it('ist zyklenfest (Rückkante zum Antragsteller und Ringe)', () => {
    // A --60 %--> B --70 %--> A (Ring) plus B --55 %--> D
    const graph: Record<string, Rohdaten> = {
      [START]: roh('Antragsteller GmbH', { holdings: [holding('B', 'Ring GmbH', 60)] }),
      B: roh('Ring GmbH', { owners: [owner(START, 'Antragsteller GmbH', 70)], holdings: [holding('D', 'D GmbH', 55)] }),
      D: roh('D GmbH'),
    }
    const { ergebnis, fehlendeIds } = analysiereVerbundKette(graph, START)
    expect(ergebnis.beteiligungen.map((b) => b.registerId).sort()).toEqual(['B', 'D'])
    expect(fehlendeIds).toEqual([])
  })

  it('meldet fehlende Rohdaten in fehlendeIds (Treiber lädt nach)', () => {
    const graph = { [START]: roh('Antragsteller GmbH', { owners: [owner('X', 'Mutter GmbH', 60)] }) }
    const { fehlendeIds, ergebnis } = analysiereVerbundKette(graph, START)
    expect(fehlendeIds).toEqual(['X'])
    // Die Firma steht trotzdem im Ergebnis, aber als unvollständig markiert
    expect(ergebnis.beteiligungen[0]).toMatchObject({ registerId: 'X', klasse: 'verbunden' })
    expect(ergebnis.kennzahlenUnvollstaendig).toBe(true)
  })

  it('beendet Holdings (end gesetzt) bleiben außen vor', () => {
    const graph = {
      [START]: roh('A', { holdings: [{ company_id: 'E', name: 'Ex GmbH', percentage_share: 80, end: '2020-01-01' }] }),
    }
    const { ergebnis } = analysiereVerbundKette(graph, START)
    expect(ergebnis.beteiligungen).toHaveLength(0)
  })

  it('toleriert komplett fehlende Daten', () => {
    const { ergebnis, fehlendeIds } = analysiereVerbundKette({}, START)
    expect(ergebnis.beteiligungen).toEqual([])
    expect(fehlendeIds).toEqual([START])
  })
})
