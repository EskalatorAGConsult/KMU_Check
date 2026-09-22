import { describe, expect, it } from 'vitest'

import { schemaFuerSchritt } from './schemas'
import { aktiveSchritteFuer, SCHRITTE, schrittNach } from './schritte'

/**
 * Weg-Vertrag der Journey (Eingangs-Wahl steuert die Klickstrecke):
 * 'selbst' -> nur Übersicht, Wahl, Unterlagen-Seite. 'eskalator' (oder noch
 * nicht gewaehlt) -> volle Strecke ohne die Selbst-Seite.
 */
describe('aktiveSchritteFuer (Weg-gesteuerte Klickstrecke)', () => {
  it('Concierge-Weg: volle Strecke ohne die Selbst-Seite', () => {
    const ids = aktiveSchritteFuer('eskalator').map((s) => s.id)
    expect(ids).toEqual(['uebersicht', 'beantragungsweg', 'unternehmen', 'ansprechpartner', 'kmu', 'deminimis', 'antrag', 'vollmacht'])
    expect(ids).not.toContain('selbst')
  })

  it('Selbst-Weg: nur Übersicht, Wahl und Unterlagen-Seite', () => {
    expect(aktiveSchritteFuer('selbst').map((s) => s.id)).toEqual(['uebersicht', 'beantragungsweg', 'selbst'])
  })

  it('noch nicht gewaehlt verhaelt sich wie der Concierge-Weg', () => {
    expect(aktiveSchritteFuer(undefined).length).toBe(aktiveSchritteFuer('eskalator').length)
  })

  it('Reihenfolge: die Wahl folgt direkt auf die Übersicht', () => {
    expect(SCHRITTE[0].id).toBe('uebersicht')
    expect(SCHRITTE[1].id).toBe('beantragungsweg')
  })
})

describe('beantragungsweg-Schema', () => {
  const schema = schemaFuerSchritt(schrittNach('beantragungsweg')!)

  it('akzeptiert beide Wege', () => {
    expect(schema.safeParse({ beantragungsweg: 'eskalator' }).success).toBe(true)
    expect(schema.safeParse({ beantragungsweg: 'selbst' }).success).toBe(true)
  })

  it('lehnt fehlende oder ungueltige Werte mit deutscher Meldung ab', () => {
    const leer = schema.safeParse({})
    expect(leer.success).toBe(false)
    if (!leer.success) expect(leer.error.issues[0]?.message).toMatch(/Beantragungsweg/)
    expect(schema.safeParse({ beantragungsweg: 'spaeter' }).success).toBe(false)
  })
})
