import { afterEach, describe, expect, it, vi } from 'vitest'

import { analysiereAngebot } from './angebot-analyse'

/**
 * Gemini-Client (analysiereAngebot): fetch und GEMINI_API_KEY werden gestubbt –
 * kein echter Netzwerkcall. Geprueft werden Endpoint/Modellname, Auth-Header,
 * Request-Form (inline_data base64 + erzwungenes JSON) und alle Fehlerpfade
 * mit konkreten, nutzerlesbaren Gruenden.
 */

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // "%PDF"

function okAntwort(analyse: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(analyse) }] } }] }),
    { status: 200 },
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('analysiereAngebot', () => {
  it('ruft den korrekten Endpoint mit Modell, Key-Header und PDF als inline_data auf', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(okAntwort({ kunde_firma: 'Muster GmbH' }))
    vi.stubGlobal('fetch', fetchMock)

    const ergebnis = await analysiereAngebot(PDF)

    expect(ergebnis).toEqual({ ok: true, analyse: expect.objectContaining({ kunde_firma: 'Muster GmbH' }) })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key')
    const body = JSON.parse(init.body as string)
    expect(body.contents[0].parts[0].inline_data.mime_type).toBe('application/pdf')
    expect(Buffer.from(body.contents[0].parts[0].inline_data.data, 'base64')).toEqual(Buffer.from(PDF))
    expect(body.generationConfig.responseMimeType).toBe('application/json')
  })

  it('liefert ohne API-Key einen Hinweis und ruft fetch gar nicht erst auf', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const ergebnis = await analysiereAngebot(PDF)

    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.fehler).toContain('GEMINI_API_KEY')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lehnt PDFs ueber 15 MB ohne API-Aufruf ab', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const ergebnis = await analysiereAngebot(new Uint8Array(16 * 1024 * 1024))

    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.fehler).toContain('zu groß')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('meldet HTTP-Fehler der API mit Status und Detail', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('quota exceeded', { status: 429 })))
    const konsolenSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const ergebnis = await analysiereAngebot(PDF)

    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) {
      expect(ergebnis.fehler).toContain('HTTP 429')
      expect(ergebnis.fehler).toContain('quota exceeded')
    }
    konsolenSpy.mockRestore()
  })

  it('meldet leere KI-Antworten als „keine Angebotsdaten erkannt"', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 })))

    const ergebnis = await analysiereAngebot(PDF)

    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.fehler).toContain('keine Angebotsdaten erkannt')
  })

  it('faengt Netzwerk-/Timeout-Fehler ab statt zu werfen', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')))
    const konsolenSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const ergebnis = await analysiereAngebot(PDF)

    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.fehler).toContain('Netzwerk-/Timeout-Fehler')
    konsolenSpy.mockRestore()
  })
})
