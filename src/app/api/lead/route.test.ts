import { NextRequest } from 'next/server'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../../test/msw-server'

/**
 * Lead-Route (POST /api/lead) gegen MSW-Handler: geprüft wird der
 * Weiterleitungsvertrag – serverseitige Anreicherung (IP), 200-Passthrough,
 * Webhook-Fehler → 502, fehlende URL → bewusste Annahme ohne Datenverlust.
 * DB-Auflösung (ermittleWebhookUrl) und Lead-Mail werden gemockt (deren
 * Verträge decken die eigenen Suites ab); die Lead-Mail ist best effort
 * und darf den Forward nie beeinflussen.
 */

const WEBHOOK_URL = 'https://hooks.example/n8n'

vi.mock('@/lib/db/repositories/einstellungen', () => ({
  ermittleWebhookUrl: vi.fn(async () => ({ url: WEBHOOK_URL, quelle: 'datenbank' })),
  ermittleLeadEmpfaenger: vi.fn(async () => ({ empfaenger: ['team@example.de'], quelle: 'standard' })),
}))

vi.mock('@/lib/email/notify', () => ({
  sendeLeadBenachrichtigung: vi.fn(async () => ({ ok: true })),
}))

const { POST } = await import('./route')

function leadRequest(body: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/lead', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9, 70.41.3.80' },
  })
}

const LEAD = { type: 'kmu_check_lead', company: { name: 'Mueller GmbH' }, result: { fundingRatePct: 45 } }

describe('POST /api/lead', () => {
  beforeEach(() => {
    server.resetHandlers()
  })

  it('Webhook 200: Lead weitergeleitet, serverseitig angereichert (IP aus x-forwarded-for)', async () => {
    const empfangen: unknown[] = []
    server.use(
      http.post(WEBHOOK_URL, async ({ request }) => {
        empfangen.push(await request.json())
        return HttpResponse.json({ ok: true })
      }),
    )

    const res = await POST(leadRequest(JSON.stringify(LEAD)))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; forwarded: boolean }
    expect(body).toEqual({ ok: true, forwarded: true })

    expect(empfangen).toHaveLength(1)
    const payload = empfangen[0] as { company: { name: string }; server: { ip: string | null } }
    expect(payload.company.name).toBe('Mueller GmbH') // Client-Payload unverändert durchgereicht
    expect(payload.server.ip).toBe('203.0.113.9') // erster x-forwarded-for-Eintrag
  })

  it('Webhook antwortet mit Fehlerstatus → 502, Lead gilt als nicht weitergeleitet', async () => {
    server.use(http.post(WEBHOOK_URL, () => HttpResponse.json({ error: 'kaputt' }, { status: 503 })))
    const konsolenSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(leadRequest(JSON.stringify(LEAD)))
    konsolenSpy.mockRestore()

    expect(res.status).toBe(502)
    const body = (await res.json()) as { ok: boolean; forwarded: boolean; status: number }
    expect(body).toEqual({ ok: false, forwarded: false, status: 503 })
  })

  it('keine konfigurierte URL: Lead trotzdem angenommen (kein Datenverlust für den Nutzer)', async () => {
    const { ermittleWebhookUrl } = await import('@/lib/db/repositories/einstellungen')
    vi.mocked(ermittleWebhookUrl).mockResolvedValueOnce({ url: null, quelle: 'keine' })
    const empfangen: unknown[] = []
    server.use(http.post(WEBHOOK_URL, async ({ request }) => {
      empfangen.push(await request.json())
      return HttpResponse.json({ ok: true })
    }))

    const res = await POST(leadRequest(JSON.stringify(LEAD)))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; forwarded: boolean; reason: string }
    expect(body).toEqual({ ok: true, forwarded: false, reason: 'webhook_url_missing' })
    expect(empfangen).toHaveLength(0) // kein Blind-Versand
  })

  it('Webhook-Auflösung wirft (DB-Störung): Lead trotzdem angenommen, ohne Forward', async () => {
    const { ermittleWebhookUrl } = await import('@/lib/db/repositories/einstellungen')
    vi.mocked(ermittleWebhookUrl).mockRejectedValueOnce(new Error('Datenbank nicht erreichbar'))
    const konsolenSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(leadRequest(JSON.stringify(LEAD)))
    konsolenSpy.mockRestore()

    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; forwarded: boolean; reason: string }
    expect(body).toEqual({ ok: true, forwarded: false, reason: 'webhook_lookup_failed' })
  })

  it('ungültiges JSON → 400 invalid_json', async () => {
    const res = await POST(leadRequest('kein json'))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toEqual({ ok: false, error: 'invalid_json' })
  })
})
