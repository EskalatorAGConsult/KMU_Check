import { describe, expect, it } from 'vitest'

import { fortschrittInfo } from './fortschritt-info'

describe('fortschrittInfo (Goal-Gradient)', () => {
  it('beim ersten Schritt ist nichts erledigt (0 %)', () => {
    const f = fortschrittInfo(0, 8)
    expect(f.erledigt).toBe(0)
    expect(f.prozent).toBe(0)
    expect(f.fertig).toBe(false)
  })

  it('nach der Haelfte sind 50 % erledigt', () => {
    expect(fortschrittInfo(4, 8).prozent).toBe(50)
  })

  it('nach dem letzten Schritt ist alles fertig (100 %, 0 Minuten)', () => {
    const f = fortschrittInfo(8, 8)
    expect(f.prozent).toBe(100)
    expect(f.restMinuten).toBe(0)
    expect(f.fertig).toBe(true)
  })

  it('Restzeit sinkt mit jedem erledigten Schritt, nie unter 1 Minute', () => {
    const a = fortschrittInfo(1, 8)
    const b = fortschrittInfo(6, 8)
    expect(b.restMinuten).toBeLessThan(a.restMinuten)
    expect(b.restMinuten).toBeGreaterThanOrEqual(1)
  })

  it('toleriert Ausreisser (negative/zu grosse Indizes)', () => {
    expect(fortschrittInfo(-3, 8).prozent).toBe(0)
    expect(fortschrittInfo(99, 8).prozent).toBe(100)
    expect(fortschrittInfo(0, 0).prozent).toBe(0)
  })
})
