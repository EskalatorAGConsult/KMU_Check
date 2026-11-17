import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../test/msw-server'

import { sendeTestMail } from './notify'

/**
 * E-Mail-Versand (`sendeMail` in notify.ts) gegen MSW-Handler: die Resend-
 * SDK-Anfrage an api.resend.com wird deterministisch abgefangen. Geprüft
 * werden der Sicherheitsnetz-Vertrag (Testadressen blockiert, fehlender
 * Key → best effort skip) und die Resend-Fehlerdurchleitung.
 */

const RESEND = 'https://api.resend.com/emails'

interface Fang {
  aufrufe: { from: string; to: string[]; subject: string }[]
  html: string[]
  status: number
  antwort: Record<string, unknown>
}

function registriereHandlerMitHtml(fang: Fang): void {
  server.use(
    http.post(RESEND, async ({ request }) => {
      const body = (await request.json()) as { from: string; to: string | string[]; subject: string; html: string }
      fang.aufrufe.push({ from: body.from, to: Array.isArray(body.to) ? body.to : [body.to], subject: body.subject })
      fang.html.push(body.html)
      return HttpResponse.json({ id: 'mail_test_2' })
    }),
  )
}

function registriereHandler(fang: Fang): void {
  server.use(
    http.post(RESEND, async ({ request }) => {
      const body = (await request.json()) as { from: string; to: string | string[]; subject: string }
      fang.aufrufe.push({ from: body.from, to: Array.isArray(body.to) ? body.to : [body.to], subject: body.subject })
      if (fang.status !== 200) return HttpResponse.json(fang.antwort, { status: fang.status })
      return HttpResponse.json({ id: 'mail_test_1' })
    }),
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sendeTestMail (Resend-Vertrag)', () => {
  it('ohne RESEND_API_KEY: best effort übersprungen, ohne HTTP-Aufruf', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const fang: Fang = { aufrufe: [], html: [], status: 200, antwort: {} }
    registriereHandler(fang)

    const erg = await sendeTestMail('admin@mabe.de')
    expect(erg.ok).toBe(false)
    if (!erg.ok) expect(erg.grund).toContain('Kein Resend-API-Key')
    expect(fang.aufrufe).toHaveLength(0)
  })

  it('Test-/Platzhalter-Adresse: Versand bewusst blockiert (Sicherheitsnetz)', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_1234567890')
    const fang: Fang = { aufrufe: [], html: [], status: 200, antwort: {} }
    registriereHandler(fang)

    const erg = await sendeTestMail('kunde@example.com')
    expect(erg.ok).toBe(false)
    if (!erg.ok) expect(erg.grund).toContain('Test-/Platzhalter-Adressen')
    expect(fang.aufrufe).toHaveLength(0)
  })

  it('kaputte Adresse (ohne gültige Domain): blockiert', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_1234567890')
    const fang: Fang = { aufrufe: [], html: [], status: 200, antwort: {} }
    registriereHandler(fang)

    const erg = await sendeTestMail('kaputt@keinedomain')
    expect(erg.ok).toBe(false)
    expect(fang.aufrufe).toHaveLength(0)
  })

  it('erfolgreicher Versand: Absender, Empfänger und Betreff erreichen die API', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_1234567890')
    vi.stubEnv('EMAIL_FROM', '') // deterministisch: Code-Fallback als Absender
    const fang: Fang = { aufrufe: [], html: [], status: 200, antwort: {} }
    registriereHandler(fang)

    const erg = await sendeTestMail('admin@mabe.de')
    expect(erg.ok).toBe(true)
    expect(fang.aufrufe).toHaveLength(1)
    expect(fang.aufrufe[0].to).toEqual(['admin@mabe.de'])
    expect(fang.aufrufe[0].subject).toContain('Test-Mail')
    expect(fang.aufrufe[0].from).toContain('@')
    // EMAIL_FROM-Fallback: Absender-Domain foerderportal.mabe.de.
    expect(fang.aufrufe[0].from).toContain('foerderportal.mabe.de')
  })

  it('Resend-Fehler (422, Domain nicht verifiziert): Grund wird durchgereicht statt verschluckt', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_1234567890')
    const fang: Fang = { aufrufe: [], html: [], status: 422, antwort: { message: 'The foerderportal.mabe.de domain is not verified' } }
    registriereHandler(fang)
    const konsolenSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const erg = await sendeTestMail('admin@mabe.de')
    konsolenSpy.mockRestore()

    expect(erg.ok).toBe(false)
    if (!erg.ok) expect(erg.grund).toContain('domain is not verified')
    expect(fang.aufrufe).toHaveLength(1)
  })
})

// ---------- sendeBescheidHinweisAnAdmins (Migration 25) ----------

/** Empfänger-Lookup läuft über die DB – in Unit-Tests gemockt (Muster lead-route.test). */
vi.mock('@/lib/db/repositories/einstellungen', () => ({
  ermittleLeadEmpfaenger: vi.fn(async () => ({ empfaenger: ['team@mabe.de'], quelle: 'standard' })),
  ermittleWebhookUrl: vi.fn(async () => ({ url: null, quelle: 'keine' })),
}))

describe('sendeBescheidHinweisAnAdmins (Fristen-Hinweis)', () => {
  it('informiert das Team mit erkannter VNW-Frist im Betreff-Kontext (best effort)', async () => {
    const { sendeBescheidHinweisAnAdmins } = await import('./notify')
    const fang: Fang = { aufrufe: [], html: [], status: 200, antwort: {} }
    registriereHandler(fang)

    vi.stubEnv('RESEND_API_KEY', 're_test_1234567890')
    const erg = await sendeBescheidHinweisAnAdmins({
      kundeFirma: 'Mueller Werkzeugbau GmbH',
      angebotNr: 'ANG-2026-042',
      fristAm: '2027-04-30',
      hochgeladenVon: 'Kunde (info@mueller-wzb.de)',
    })

    expect(erg.ok).toBe(true)
    expect(fang.aufrufe).toHaveLength(1)
    expect(fang.aufrufe[0].to).toEqual(['team@mabe.de'])
    expect(fang.aufrufe[0].subject).toContain('ANG-2026-042')
    expect(fang.aufrufe[0].subject).toContain('Zuwendungsbescheid')
  })

  it('ohne erkannte Frist: Hinweis „bitte im Portal prüfen“ statt geratener Datum', async () => {
    const { sendeBescheidHinweisAnAdmins } = await import('./notify')
    const fang: Fang = { aufrufe: [], html: [], status: 200, antwort: {} }
    registriereHandlerMitHtml(fang)

    vi.stubEnv('RESEND_API_KEY', 're_test_1234567890')
    const erg = await sendeBescheidHinweisAnAdmins({
      kundeFirma: 'Muster GmbH',
      angebotNr: 'ANG-2026-043',
      fristAm: null,
      hochgeladenVon: 'Team (m.dick@mabe.de)',
    })

    expect(erg.ok, `grund: ${erg.ok ? '' : (erg.grund ?? '?')}`).toBe(true)
    expect(fang.html[0]).toContain('noch nicht erkannt')
  })
})
