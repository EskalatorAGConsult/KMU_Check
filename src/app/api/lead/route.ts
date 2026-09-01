import { NextRequest, NextResponse } from 'next/server'

import { ermittleWebhookUrl } from '@/lib/db/repositories/einstellungen'
import { sendeLeadBenachrichtigung } from '@/lib/email/notify'
import type { LeadPayload } from '@/lib/email/lead-benachrichtigung'

export const runtime = 'nodejs'

/**
 * Nimmt den Lead aus dem KMU-Check entgegen und leitet ihn serverseitig an den
 * konfigurierten Webhook weiter. Die Webhook-URL kommt aus den Admin-
 * Einstellungen (DB) mit ENV-Fallback WEBHOOK_URL und wird niemals an den
 * Client ausgeliefert.
 */
export async function POST(req: NextRequest) {
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const { url: webhookUrl } = await ermittleWebhookUrl()

  // Server-seitige Anreicherung (IP, Geo-Header, Eingangszeit).
  const enriched = {
    ...(typeof payload === 'object' && payload ? payload : { raw: payload }),
    server: {
      received_at: new Date().toISOString(),
      ip:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        null,
      country: req.headers.get('x-vercel-ip-country') || null,
      region: req.headers.get('x-vercel-ip-country-region') || null,
      city: req.headers.get('x-vercel-ip-city') || null,
      user_agent: req.headers.get('user-agent') || null,
    },
  }

  // Interne Benachrichtigung mit allen Angaben (kopierfähige Tabellen fuer
  // das BAFA-Portal). Laueft unabhaengig vom Webhook und blockiert nie.
  try {
    await sendeLeadBenachrichtigung(enriched as unknown as LeadPayload)
  } catch (e) {
    console.error('[lead] E-Mail-Benachrichtigung fehlgeschlagen:', e)
  }

  if (!webhookUrl) {
    // Ohne konfigurierte URL akzeptieren wir den Lead, loggen aber den Hinweis.
    console.warn('[lead] Keine Webhook-URL konfiguriert (DB/ENV) – Lead wurde nicht weitergeleitet.')
    return NextResponse.json({ ok: true, forwarded: false, reason: 'webhook_url_missing' })
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enriched),
    })
    if (!res.ok) {
      console.error('[lead] Webhook antwortete mit Status', res.status)
      return NextResponse.json({ ok: false, forwarded: false, status: res.status }, { status: 502 })
    }
    return NextResponse.json({ ok: true, forwarded: true })
  } catch (err) {
    console.error('[lead] Webhook-Weiterleitung fehlgeschlagen', err)
    return NextResponse.json({ ok: false, forwarded: false, error: 'forward_failed' }, { status: 502 })
  }
}
