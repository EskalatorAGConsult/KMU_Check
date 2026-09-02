import { describe, expect, it } from 'vitest'

import { winAnsi } from './writer'

/**
 * WinAnsi-Sanitizer: garantiert, dass kein generiertes PDF mehr an
 * Sonderzeichen scheitert (Produktionsfehler 01.09.2026: „≤" aus den
 * KMU-Begruendungstexten echter Vorgaenge).
 */
describe('winAnsi', () => {
  it('laesst CP1252-Text unveraendert (Umlaute, Gedankenstrich, Euro, Quotes)', () => {
    const text = 'Müller & Söhne – „Größe“ äöüß · 50 Mio. € …'
    expect(winAnsi(text)).toBe(text)
  })

  it('ersetzt mathematische Zeichen durch ASCII-Aequivalente', () => {
    expect(winAnsi('Umsatz ≤ 50 Mio. und Bilanz ≥ 43 Mio.')).toBe('Umsatz <= 50 Mio. und Bilanz >= 43 Mio.')
    expect(winAnsi('alt → neu')).toBe('alt -> neu')
    // „×" (U+00D7) ist in CP1252 enthalten und bleibt; echtes Minus (U+2212) nicht
    expect(winAnsi('−5 × 2')).toBe('-5 × 2')
  })

  it('ersetzt Emojis und unbekannte Zeichen statt zu crashen', () => {
    expect(winAnsi('⭐ Empfehlung')).toBe('* Empfehlung')
    expect(winAnsi('漢字')).toBe('??')
    expect(winAnsi('✓ erledigt')).toBe('[OK] erledigt')
  })

  it('ist auf ganzen KMU-Reason-Strings absturzfrei', () => {
    const reason = 'Sowohl Umsatz (> 50 Mio. €) als auch Bilanzsumme (> 43 Mio. €) liegen über den KMU-Grenzen – ≤ gilt.'
    const out = winAnsi(reason)
    expect(out).toContain('€')
    expect(out).toContain('<=')
  })
})
