import { describe, expect, it } from 'vitest'

import { kmuSchema } from '@/lib/journey/schemas'

/**
 * Journey-Schema KMU-Schritt: zwei Geschaeftsjahre sind Pflicht
 * (dynamisch die letzten zwei abgeschlossenen), eines reicht nicht.
 */
describe('kmuSchema – zwei Geschäftsjahre', () => {
  const jahr = (gj: number) => ({ geschaeftsjahr: gj, abgeschlossen: true, jae: 20, umsatz: 3_000_000, bilanzsumme: 2_000_000 })

  it('akzeptiert genau zwei Jahre', () => {
    const res = kmuSchema.safeParse({ jahre: [jahr(2025), jahr(2024)], beteiligungen: [] })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.jahre).toHaveLength(2)
  })

  it('lehnt ein einzelnes Jahr ab', () => {
    expect(kmuSchema.safeParse({ jahre: [jahr(2025)], beteiligungen: [] }).success).toBe(false)
  })

  it('lehnt fehlende JAE ab', () => {
    const res = kmuSchema.safeParse({ jahre: [{ geschaeftsjahr: 2025 }, jahr(2024)], beteiligungen: [] })
    expect(res.success).toBe(false)
  })

  it('wendet Defaults an (abgeschlossen, umsatz, bilanzsumme)', () => {
    const res = kmuSchema.safeParse({
      jahre: [{ geschaeftsjahr: 2025, jae: 5 }, { geschaeftsjahr: 2024, jae: 4 }],
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.jahre[0].abgeschlossen).toBe(true)
      expect(res.data.jahre[0].umsatz).toBe(0)
      expect(res.data.beteiligungen).toEqual([])
    }
  })
})
