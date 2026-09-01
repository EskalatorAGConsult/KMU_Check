import { describe, expect, it } from 'vitest'

import { bildeDiff, formatiereWert, hatAenderungen } from './revision-diff'

/**
 * Revisions-Diff: Kern der Admin-Historie. Muss exakt die geaenderten
 * Felder liefern – nicht mehr (sonst Rauschen im Protokoll), nicht weniger
 * (sonst verlorene Nachvollziehbarkeit). Mass-Assignment-Schutz ueber die
 * Feld-Whitelist wird mitgeprueft.
 */

describe('bildeDiff', () => {
  it('liefert nur geaenderte Felder der Whitelist', () => {
    const diff = bildeDiff(
      { kunde_firma: 'Alt GmbH', ort: 'Hagen', notiz: 'x' },
      { kunde_firma: 'Neu GmbH', ort: 'Hagen', hackerfeld: 'böse' },
      ['kunde_firma', 'ort'],
    )
    expect(diff).toEqual({ kunde_firma: { alt: 'Alt GmbH', neu: 'Neu GmbH' } })
    expect(hatAenderungen(diff)).toBe(true)
  })

  it('behandelt leere Strings und null als gleich', () => {
    const diff = bildeDiff({ notiz: null }, { notiz: '   ' }, ['notiz'])
    expect(hatAenderungen(diff)).toBe(false)
  })

  it('vergleicht numerische Strings und Zahlen numerisch (PostgREST numeric)', () => {
    expect(hatAenderungen(bildeDiff({ invest: '26750.50' }, { invest: 26750.5 }, ['invest']))).toBe(false)
    expect(hatAenderungen(bildeDiff({ invest: '26750.50' }, { invest: 26750.51 }, ['invest']))).toBe(true)
  })

  it('erkennt Array-Aenderungen (technologien)', () => {
    const alt = { technologien: ['software', 'messtechnik'] }
    expect(hatAenderungen(bildeDiff(alt, { technologien: ['software', 'messtechnik'] }, ['technologien']))).toBe(false)
    const diff = bildeDiff(alt, { technologien: ['software'] }, ['technologien'])
    expect(diff.technologien).toEqual({ alt: ['software', 'messtechnik'], neu: ['software'] })
  })

  it('trimmt Strings vor dem Vergleich', () => {
    expect(hatAenderungen(bildeDiff({ ort: 'Hagen' }, { ort: '  Hagen ' }, ['ort']))).toBe(false)
  })
})

describe('formatiereWert', () => {
  it('formatiert null, boolean, Zahl und Array deutsch', () => {
    expect(formatiereWert(null)).toBe('–')
    expect(formatiereWert(true)).toBe('Ja')
    expect(formatiereWert(1234.5)).toBe((1234.5).toLocaleString('de-DE'))
    expect(formatiereWert(['a', 'b'])).toBe('a, b')
  })
})
