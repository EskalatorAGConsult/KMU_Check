import { describe, expect, it } from 'vitest'

import { holdingsFuerJahr, jahrKennzahl, jahreAufbauen } from './verbund-jahre'

/**
 * Jahresbezogener Zugriff auf Verbund-Kennzahlen (BAFA fragt 2025 UND 2024 ab
 * – auch für Partner-/verbundene Unternehmen). Kern-Invarianten (Audit
 * 02.09.2026): (1) je Jahr fliessen DIESES Jahr passende Werte in die
 * Verbundrechnung, (2) niemals werden Werte per Skalar-Fallback „erfunden",
 * wenn ein Jahres-Array existiert, (3) Alt-Drafts mit String-Skalarwerten und
 * DB-Zeilen (kennzahlen, null-Werte) werden koerziert statt verworfen.
 */
describe('jahrKennzahl', () => {
  it('liefert den jahrespassenden Wert (Draft: jahre)', () => {
    const b = {
      jahre: [
        { geschaeftsjahr: 2025, jae: 12, umsatz: 1_000, bilanzsumme: 2_000 },
        { geschaeftsjahr: 2024, jae: 10, umsatz: 800, bilanzsumme: 1_700 },
      ],
    }
    expect(jahrKennzahl(b, 2025, 'jae')).toBe(12)
    expect(jahrKennzahl(b, 2024, 'jae')).toBe(10)
    expect(jahrKennzahl(b, 2024, 'umsatz')).toBe(800)
    expect(jahrKennzahl(b, 2024, 'bilanzsumme')).toBe(1_700)
  })

  it('liest auch DB-Zeilen (kennzahlen) inkl. null-Werten', () => {
    const row = {
      kennzahlen: [
        { geschaeftsjahr: 2025, jae: 12, umsatz: null, bilanzsumme: 2_000 },
        { geschaeftsjahr: 2024, jae: null, umsatz: 800, bilanzsumme: null },
      ],
      jae: 12, // Skalarspalte (neuestes Jahr) – darf 2024 NICHT überschreiben
      umsatz: null,
    }
    expect(jahrKennzahl(row, 2025, 'umsatz')).toBeNull()
    expect(jahrKennzahl(row, 2024, 'jae')).toBeNull()
    expect(jahrKennzahl(row, 2024, 'umsatz')).toBe(800)
  })

  it('fällt OHNE Jahres-Array auf den Skalarwert zurück (Alt-Draft) – Strings inklusive', () => {
    expect(jahrKennzahl({ jae: 7, umsatz: 500 }, 2025, 'jae')).toBe(7)
    expect(jahrKennzahl({ jae: '7', umsatz: '1.234,50' }, 2024, 'jae')).toBe(7)
    expect(jahrKennzahl({ umsatz: '1.234,50' }, 2024, 'umsatz')).toBe(1234.5)
  })

  it('erfindet KEINE Werte per Skalar-Fallback, wenn ein Jahres-Array existiert (Audit-Regel)', () => {
    // Register liefert nur 2024 (Skalar = 2024er Neuestwert): 2025 bleibt
    // bewusst leer – kein „Überstülpen" des Vorjahres als angebliche 2025er Zahl.
    const b = { jahre: [{ geschaeftsjahr: 2024, jae: 10 }], jae: 10 }
    expect(jahrKennzahl(b, 2025, 'jae')).toBeNull()
    expect(jahrKennzahl(b, 2024, 'jae')).toBe(10)
    // Leerer Jahre-Eintrag = null (Zelle leerbar), nicht Skalar-Erfindung:
    expect(jahrKennzahl({ jahre: [{ geschaeftsjahr: 2025 }], jae: 99 }, 2025, 'jae')).toBeNull()
  })

  it('filtert ungültige Werte (negative, NaN, Buchstaben)', () => {
    expect(jahrKennzahl({ jae: -3 }, 2025, 'jae')).toBeNull()
    expect(jahrKennzahl({ jae: NaN }, 2025, 'jae')).toBeNull()
    expect(jahrKennzahl({ jae: 'abc' }, 2025, 'jae')).toBeNull()
  })
})

describe('holdingsFuerJahr', () => {
  const beteiligungen = [
    {
      name: 'Holding GmbH',
      anteil_pct: 60,
      bezug: undefined,
      jahre: [
        { geschaeftsjahr: 2025, jae: 100, umsatz: 10_000, bilanzsumme: 20_000 },
        { geschaeftsjahr: 2024, jae: 50, umsatz: 5_000, bilanzsumme: 9_000 },
      ],
    },
    { name: 'Alt-Draft UG', anteil_pct: '30', bezug: null, jae: '8', umsatz: 700, bilanzsumme: 600 },
    { name: '', anteil_pct: 50 }, // leere Zeile: raus
    { name: 'Null-Quote AG', anteil_pct: 0, jae: 5 }, // 0 %: raus
  ]

  it('baut je Jahr die passenden Holding-Zahlen (nicht mehr dieselben für beide Jahre)', () => {
    const h2025 = holdingsFuerJahr(beteiligungen, 2025)
    const h2024 = holdingsFuerJahr(beteiligungen, 2024)
    expect(h2025).toHaveLength(2)
    expect(h2024).toHaveLength(2)
    expect(h2025[0]).toMatchObject({ name: 'Holding GmbH', sharePct: 60, employees: 100, turnover: 10_000, balanceSheet: 20_000 })
    expect(h2024[0]).toMatchObject({ employees: 50, turnover: 5_000, balanceSheet: 9_000 })
    // Alt-Draft ohne jahre (Quote als String): Skalar-Fallback in beiden Jahren
    expect(h2025[1]).toMatchObject({ name: 'Alt-Draft UG', sharePct: 30, employees: 8, turnover: 700 })
    expect(h2024[1]).toMatchObject({ employees: 8, turnover: 700 })
  })

  it('bezug wird getrimmt weitergegeben, quote/name sanitizet', () => {
    const h = holdingsFuerJahr([{ name: ' Y GmbH ', anteil_pct: 40, bezug: ' X AG ' }], 2025)
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ name: 'Y GmbH', sharePct: 40, bezug: 'X AG' })
  })
})

describe('jahreAufbauen', () => {
  it('hält vorhandene Einträge unangetastet und lässt fehlende Jahre LEER (Skalar stört nicht)', () => {
    const b = {
      jae: 9,
      umsatz: 1_000,
      jahre: [{ geschaeftsjahr: 2025, jae: 12, umsatz: 1_400 }],
    }
    expect(jahreAufbauen(b, [2025, 2024])).toEqual([
      { geschaeftsjahr: 2025, jae: 12, umsatz: 1_400, bilanzsumme: undefined },
      { geschaeftsjahr: 2024 }, // fehlt im Array -> LEER, kein Skalar-Erbe
    ])
  })

  it('lässt fehlende Jahre LEER, wenn ein Array existiert (keine Skalar-Erfindung)', () => {
    const b = { jae: 99, jahre: [{ geschaeftsjahr: 2024, jae: 10 }] }
    expect(jahreAufbauen(b, [2025, 2024])).toEqual([
      { geschaeftsjahr: 2025 },
      { geschaeftsjahr: 2024, jae: 10 },
    ])
  })

  it('baut ohne jahre beide Jahre aus den Skalarwerten (Legacy-Migration, Strings koerziert)', () => {
    expect(jahreAufbauen({ jae: '5', umsatz: '800,50' }, [2025, 2024])).toEqual([
      { geschaeftsjahr: 2025, jae: 5, umsatz: 800.5, bilanzsumme: undefined },
      { geschaeftsjahr: 2024, jae: 5, umsatz: 800.5, bilanzsumme: undefined },
    ])
  })
})
