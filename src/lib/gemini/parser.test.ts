import { describe, expect, it } from 'vitest'

import { parseAngebotAnalyse } from './parser'

/**
 * Gemini-Parser: KI-Ausgaben sind unzuverlaessig – der Parser muss defensiv
 * normalisieren (Codefences, deutsche Zahlenformate, Datumsformate) und bei
 * Muell null liefern statt zu crashen.
 */

describe('parseAngebotAnalyse', () => {
  it('parst eine saubere JSON-Antwort vollständig', () => {
    const roh = JSON.stringify({
      kunde_firma: 'Musterwerk GmbH',
      kunde_ansprechpartner: 'Erika Muster',
      strasse: 'Industrieweg 4',
      plz: '58095',
      ort: 'Hagen',
      ust_id: 'DE 123 456 789',
      angebot_nr: 'ANG-2026-071',
      angebot_datum: '2026-08-20',
      invest_messtechnik: 24800,
      invest_steuerung: 5600,
      sensoren_gesamt: 36,
      sensoren_prozessbezug: 12,
      projektende: '2027-03-31',
    })
    const a = parseAngebotAnalyse(roh)
    expect(a?.kunde_firma).toBe('Musterwerk GmbH')
    expect(a?.ust_id).toBe('DE123456789') // normalisiert: ohne Leerzeichen, gross
    expect(a?.invest_messtechnik).toBe(24800)
    expect(a?.sensoren_gesamt).toBe(36)
    expect(a?.projektende).toBe('2027-03-31')
  })

  it('entfernt Markdown-Codefences und deutsche Zahlenformate', () => {
    const roh = '```json\n{"kunde_firma": "Test AG", "invest_software": "12.345,67 €", "angebot_datum": "20.08.2026"}\n```'
    const a = parseAngebotAnalyse(roh)
    expect(a?.invest_software).toBe(12345.67)
    expect(a?.angebot_datum).toBe('2026-08-20')
  })

  it('liefert null bei ungültigem JSON oder leerem Ergebnis', () => {
    expect(parseAngebotAnalyse('gar kein json')).toBeNull()
    expect(parseAngebotAnalyse('{"foo": 1}')).toBeNull() // kein einziges bekanntes Feld gefuellt
    expect(parseAngebotAnalyse('[1,2,3]')).toBeNull()
  })

  it('verwirft falsche Typen und ungültige USt-Ids statt zu raten', () => {
    const a = parseAngebotAnalyse(
      JSON.stringify({ kunde_firma: 'X GmbH', invest_software: 'teuer', ust_id: 'keine', sensoren_gesamt: -5 }),
    )
    expect(a?.invest_software).toBeNull()
    expect(a?.ust_id).toBeNull()
    expect(a?.sensoren_gesamt).toBeNull()
  })
})
