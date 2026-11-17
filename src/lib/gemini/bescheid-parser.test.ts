import { describe, expect, it } from 'vitest'

import { parseBescheidAnalyse } from './bescheid-parser'

/**
 * Parser der Bescheid-OCR: defensive Normalisierung, keine Erfindungen.
 * Reine Funktion – ohne Netzwerk testbar.
 */

const ANTWORT = JSON.stringify({
  aktenzeichen: 'EEW3/2026/004711',
  bewilligt_am: '05.11.2026',
  foerderquote_pct: 45,
  foerdersumme_eur: '12.500,50',
  durchfuehrung_von: '2026-11-06',
  durchfuehrung_bis: '31.01.2027',
  vnw_frist_am: '2027-04-30',
  auflagen: ['Beginn der Maßnahme erst nach Erhalt dieses Bescheids.', ''],
  hinweise: ['Auszahlung nach Prüfung des Verwendungsnachweises.'],
})

describe('parseBescheidAnalyse', () => {
  it('normalisiert Datum (DE → ISO), deutsche Beträge, Quote und Listen', () => {
    const a = parseBescheidAnalyse(ANTWORT)
    expect(a).not.toBeNull()
    expect(a?.aktenzeichen).toBe('EEW3/2026/004711')
    expect(a?.bewilligt_am).toBe('2026-11-05')
    expect(a?.foerderquote_pct).toBe(45)
    expect(a?.foerdersumme_eur).toBe(12500.5)
    expect(a?.durchfuehrung_von).toBe('2026-11-06')
    expect(a?.durchfuehrung_bis).toBe('2027-01-31')
    expect(a?.vnw_frist_am).toBe('2027-04-30')
    expect(a?.auflagen).toHaveLength(1) // leerer Eintrag gefiltert
    expect(a?.hinweise).toEqual(['Auszahlung nach Prüfung des Verwendungsnachweises.'])
  })

  it('ungültige Förderquote wird verworfen (30 % ist keine Programm-Quote)', () => {
    const a = parseBescheidAnalyse(JSON.stringify({ aktenzeichen: 'X', foerderquote_pct: 30 }))
    expect(a?.aktenzeichen).toBe('X')
    expect(a?.foerderquote_pct).toBeNull()
  })

  it('Markdown-Codefence wird bereinigt', () => {
    const a = parseBescheidAnalyse('```json\n' + ANTWORT + '\n```')
    expect(a?.vnw_frist_am).toBe('2027-04-30')
  })

  it('ungültiges JSON → null', () => {
    expect(parseBescheidAnalyse('kein json')).toBeNull()
    expect(parseBescheidAnalyse('[]')).toBeNull()
    expect(parseBescheidAnalyse('42')).toBeNull()
  })

  it('vollständig leere Antwort → null (nichts erfinden)', () => {
    expect(parseBescheidAnalyse(JSON.stringify({ aktenzeichen: null, auflagen: [], hinweise: [] }))).toBeNull()
  })

  it('unkannte/fehlerhafte Feldtypen werden sicher ignoriert', () => {
    const a = parseBescheidAnalyse(
      JSON.stringify({
        bewilligt_am: 123, // Zahl statt String -> null
        foerdersumme_eur: { euro: 1 }, // Objekt -> null
        auflagen: 'keine Liste', // kein Array -> []
        hinweise: [null, 42, '  gültig  '],
      }),
    )
    expect(a).not.toBeNull()
    expect(a?.bewilligt_am).toBeNull()
    expect(a?.foerdersumme_eur).toBeNull()
    expect(a?.auflagen).toEqual([])
    expect(a?.hinweise).toEqual(['gültig'])
  })

  it('Duplikate werden entfernt; Grenze bei 20 einzigartigen Einträgen', () => {
    // 25 identische + 5 individuelle -> dedupliert 6 einzigartige
    const viele = Array.from({ length: 30 }, (_, i) => (i < 25 ? 'wiederholt' : `Auflage ${i}`))
    const a = parseBescheidAnalyse(JSON.stringify({ vnw_frist_am: '2027-04-30', auflagen: viele }))
    expect(a?.auflagen).toEqual(['wiederholt', 'Auflage 25', 'Auflage 26', 'Auflage 27', 'Auflage 28', 'Auflage 29'])
    expect(new Set(a?.auflagen).size).toBe(a?.auflagen.length)

    // 25 einzigartige -> Kappung bei 20
    const uniq = Array.from({ length: 25 }, (_, i) => `Auflage ${i}`)
    const b = parseBescheidAnalyse(JSON.stringify({ vnw_frist_am: '2027-04-30', auflagen: uniq }))
    expect(b?.auflagen).toHaveLength(20)
    expect(b?.auflagen[19]).toBe('Auflage 19')
  })
})
