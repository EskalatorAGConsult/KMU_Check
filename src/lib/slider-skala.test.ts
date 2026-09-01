import { describe, expect, it } from 'vitest'

import { schienenPosition, SKALA } from './slider-skala'

describe('schienenPosition (Slider 25–100)', () => {
  it('bildet die Enden korrekt ab', () => {
    expect(schienenPosition(25)).toBe(0)
    expect(schienenPosition(100)).toBe(100)
  })

  it('Wert 50 liegt bei 33,3 % der Schiene – NICHT in der Mitte', () => {
    expect(schienenPosition(50)).toBeCloseTo(33.333, 2)
  })

  it('die Schienenmitte gehoert dem Wert 62,5', () => {
    expect(schienenPosition(62.5)).toBe(50)
  })

  it('SKALA-Konstanten stimmen mit der Funktion ueberein', () => {
    expect(SKALA.kipppunkt50).toBeCloseTo(33.333, 2)
    expect(SKALA.zonePartner).toBeCloseTo(16.667, 2)
    expect(SKALA.zoneVerbunden).toBeCloseTo(66.667, 2)
  })
})
