import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Nimmt den Lead aus dem KMU-Check entgegen und leitet ihn serverseitig an den
 * konfigurierten Webhook weiter. Die Webhook-URL wird ausschließlich über die
 * Umgebungsvariable WEBHOOK_URL gelesen (in Vercel als Projekt-Variable
 * anzulegen) und niemals an den Client ausgeliefert.
 */
export async function POST(req: NextRequest) {
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const webhookUrl = process.env.WEBHOOK_URL

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

  if (!webhookUrl) {
    // Ohne konfigurierte URL akzeptieren wir den Lead, loggen aber den Hinweis.
    console.warn('[lead] WEBHOOK_URL ist nicht gesetzt – Lead wurde nicht weitergeleitet.')
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
