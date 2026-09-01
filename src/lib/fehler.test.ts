import { afterEach, describe, expect, it, vi } from 'vitest'

import { fehlerKennung, fehlerMeldung, loggeFehler } from './fehler'

describe('fehlerMeldung', () => {
  it('extrahiert Error.message', () => {
    expect(fehlerMeldung(new Error('DB down'))).toBe('DB down')
  })

  it('reicht Strings durch', () => {
    expect(fehlerMeldung('kaputt')).toBe('kaputt')
  })

  it('faellt bei Objekten/null/leeren Strings auf den Fallback zurueck', () => {
    expect(fehlerMeldung({ code: 42 })).toBe('Ein unerwarteter Fehler ist aufgetreten.')
    expect(fehlerMeldung(null)).toBe('Ein unerwarteter Fehler ist aufgetreten.')
    expect(fehlerMeldung('   ')).toBe('Ein unerwarteter Fehler ist aufgetreten.')
    expect(fehlerMeldung(undefined, 'Eigener Text')).toBe('Eigener Text')
  })

  it('kuerzt ueberlange Meldungen', () => {
    const m = fehlerMeldung(new Error('x'.repeat(500)))
    expect(m.length).toBe(300)
    expect(m.endsWith('…')).toBe(true)
  })
})

describe('fehlerKennung', () => {
  it('ist kurz, eindeutig und URL-tauglich', () => {
    const a = fehlerKennung()
    const b = fehlerKennung()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[a-z0-9-]+$/)
    expect(a.length).toBeLessThanOrEqual(20)
  })
})

describe('loggeFehler', () => {
  afterEach(() => vi.restoreAllMocks())

  it('schreibt einen strukturierten Eintrag mit Bereich und Kontext', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    loggeFehler('journey', new Error('Token defekt'), { schritt: 'kmu' })
    expect(spy).toHaveBeenCalledOnce()
    const payload = JSON.parse(spy.mock.calls[0][1] as string)
    expect(payload.bereich).toBe('journey')
    expect(payload.meldung).toBe('Token defekt')
    expect(payload.kontext).toEqual({ schritt: 'kmu' })
    expect(payload.stapel).toBeTruthy()
  })

  it('wirft nie – auch nicht bei zirkulaerem Kontext', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const zirk: Record<string, unknown> = {}
    zirk.self = zirk
    expect(() => loggeFehler('test', 'fehler', zirk)).not.toThrow()
    expect(spy).toHaveBeenCalled()
  })
})
