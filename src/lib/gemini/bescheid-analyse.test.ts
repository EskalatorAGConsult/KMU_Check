import { HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { analysiereBescheid } from './bescheid-analyse'

/**
 * Bescheid-Analyse gegen MSW: Prompt-Vertrag (Frist-Suchwörter!), Auth-Header,
 * PDF inline, Fehlerpfade – deterministisch, ohne echten API-Key-Verbrauch.
 */

const ENDPUNKT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent'

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // "%PDF"

function okAntwort(analyse: Record<string, unknown>) {
  return HttpResponse.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify(analyse) }] } }],
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('analysiereBescheid', () => {
  it('sendet Prompt mit Frist-Suchwörtern und PDF inline; Key im Header', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(okAntwort({ aktenzeichen: 'EEW3/2026/1', vnw_frist_am: '2027-04-30' }))
    vi.stubGlobal('fetch', fetchMock)

    const erg = await analysiereBescheid(PDF)

    expect(erg.ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(ENDPUNKT)
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key')
    const body = JSON.parse(init.body as string) as { contents: { parts: { text?: string }[] }[] }
    const prompt = body.contents[0].parts[1]?.text ?? ''
    expect(prompt).toContain('Verwendungsnachweis')
    expect(prompt).toContain('Vorlagefrist')
    expect(prompt).toContain('Auflagen')
  })

  it('ohne Key: konkreter Grund, kein fetch', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const erg = await analysiereBescheid(PDF)

    expect(erg.ok).toBe(false)
    if (!erg.ok) expect(erg.fehler).toContain('GEMINI_API_KEY')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('leere KI-Antwort: kein Ergebnis statt erfundener Frist', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(HttpResponse.json({ candidates: [] })))

    const erg = await analysiereBescheid(PDF)

    expect(erg.ok).toBe(false)
    if (!erg.ok) expect(erg.fehler).toContain('keine verwertbaren Daten')
  })

  it('Normalisierung durch den Parser: deutsches Datum und Betrag', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okAntwort({ bewilligt_am: '05.11.2026', foerdersumme_eur: '12.500,50', foerderquote_pct: 45 }),
      ),
    )

    const erg = await analysiereBescheid(PDF)

    expect(erg.ok).toBe(true)
    if (erg.ok) {
      expect(erg.analyse.bewilligt_am).toBe('2026-11-05')
      expect(erg.analyse.foerdersumme_eur).toBe(12500.5)
      expect(erg.analyse.foerderquote_pct).toBe(45)
    }
  })

  it('HTTP-Fehler der API wird mit Status durchgereicht', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new HttpResponse('busy', { status: 503 })))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const erg = await analysiereBescheid(PDF)
    spy.mockRestore()

    expect(erg.ok).toBe(false)
    if (!erg.ok) expect(erg.fehler).toContain('HTTP 503')
  })
})
