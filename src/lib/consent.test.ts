import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CONSENT_COOKIE,
  CONSENT_VERSION,
  COOKIE_KATALOG,
  hatEinwilligung,
  leseEinwilligung,
  speichereEinwilligung,
} from './consent'

/**
 * Consent-Management (Opt-in): Cookie-Roundtrip, Versionslogik und Katalog.
 * Laeuft in der Node-Umgebung mit minimalen document/window-Stubs.
 */

let store: Record<string, string>

beforeEach(() => {
  store = {}
  vi.stubGlobal('document', {
    get cookie() {
      return Object.entries(store)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    },
    set cookie(v: string) {
      const paar = v.split(';')[0]
      const idx = paar.indexOf('=')
      store[paar.slice(0, idx)] = paar.slice(idx + 1)
    },
  })
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
})

describe('Einwilligung (Opt-in)', () => {
  it('ohne Cookie ist nichts eingewilligt (Default: abgelehnt)', () => {
    expect(leseEinwilligung()).toBeNull()
    expect(hatEinwilligung('marketing')).toBe(false)
    expect(hatEinwilligung('statistik')).toBe(false)
  })

  it('„Alle akzeptieren“ aktiviert beide Kategorien (Roundtrip)', () => {
    speichereEinwilligung({ statistik: true, marketing: true })
    expect(hatEinwilligung('marketing')).toBe(true)
    expect(hatEinwilligung('statistik')).toBe(true)
    expect(leseEinwilligung()?.v).toBe(CONSENT_VERSION)
  })

  it('„Nur erforderliche“ speichert die Ablehnung explizit', () => {
    speichereEinwilligung({ statistik: false, marketing: false })
    expect(leseEinwilligung()).not.toBeNull() // Entscheidung dokumentiert
    expect(hatEinwilligung('marketing')).toBe(false)
    expect(hatEinwilligung('statistik')).toBe(false)
  })

  it('granulare Auswahl: nur Statistik', () => {
    speichereEinwilligung({ statistik: true, marketing: false })
    expect(hatEinwilligung('statistik')).toBe(true)
    expect(hatEinwilligung('marketing')).toBe(false)
  })

  it('defektes oder veraltetes Cookie gilt als nicht entschieden', () => {
    store[CONSENT_COOKIE] = 'kaputt-%7B'
    expect(leseEinwilligung()).toBeNull()
    store[CONSENT_COOKIE] = encodeURIComponent(JSON.stringify({ v: 999, statistik: true, marketing: true }))
    expect(leseEinwilligung()).toBeNull()
  })
})

describe('Cookie-Katalog', () => {
  it('deklariert alle Kategorien mit Eintraegen; notwendig ist nicht abwaehlbar', () => {
    const ids = COOKIE_KATALOG.map((k) => k.id)
    expect(ids).toContain('notwendig')
    expect(ids).toContain('statistik')
    expect(ids).toContain('marketing')
    for (const kat of COOKIE_KATALOG) {
      expect(kat.eintraege.length).toBeGreaterThan(0)
      for (const e of kat.eintraege) {
        expect(e.name).toBeTruthy()
        expect(e.zweck).toBeTruthy()
        expect(e.dauer).toBeTruthy()
      }
    }
  })
})
