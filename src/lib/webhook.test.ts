import { describe, expect, it } from 'vitest'

import { istGueltigeWebhookUrl, loeseWebhookAuf } from '@/lib/webhook'

describe('loeseWebhookAuf – DB hat Vorrang vor ENV', () => {
  it('DB-Wert gewinnt', () => {
    expect(loeseWebhookAuf('https://db.example/hook', 'https://env.example/hook')).toEqual({
      url: 'https://db.example/hook',
      quelle: 'datenbank',
    })
  })

  it('ENV-Fallback ohne DB-Wert', () => {
    expect(loeseWebhookAuf(null, 'https://env.example/hook').quelle).toBe('umgebung')
    expect(loeseWebhookAuf(undefined, 'https://env.example/hook').quelle).toBe('umgebung')
  })

  it('leerer DB-Wert (Whitespace) faellt auf ENV zurueck', () => {
    expect(loeseWebhookAuf('   ', 'https://env.example/hook').quelle).toBe('umgebung')
  })

  it('keine Konfiguration → quelle "keine"', () => {
    expect(loeseWebhookAuf(null, undefined)).toEqual({ url: null, quelle: 'keine' })
    expect(loeseWebhookAuf('', ' ')).toEqual({ url: null, quelle: 'keine' })
  })

  it('DB-Wert wird getrimmt', () => {
    expect(loeseWebhookAuf('  https://db.example/hook  ', null).url).toBe('https://db.example/hook')
  })
})

describe('istGueltigeWebhookUrl', () => {
  it('https ist erlaubt', () => {
    expect(istGueltigeWebhookUrl('https://eskalator-prozesse.app.n8n.cloud/webhook/abc')).toBe(true)
  })

  it('http nur lokal (localhost/127.0.0.1)', () => {
    expect(istGueltigeWebhookUrl('http://localhost:5678/webhook')).toBe(true)
    expect(istGueltigeWebhookUrl('http://127.0.0.1:5678/webhook')).toBe(true)
    expect(istGueltigeWebhookUrl('http://example.com/hook')).toBe(false)
  })

  it('ungueltige URLs werden abgelehnt', () => {
    expect(istGueltigeWebhookUrl('')).toBe(false)
    expect(istGueltigeWebhookUrl('keine-url')).toBe(false)
    expect(istGueltigeWebhookUrl('ftp://example.com')).toBe(false)
  })
})
