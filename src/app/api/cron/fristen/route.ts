import { NextResponse } from 'next/server'

import { env } from '@/env'
import { pruefeUndErinnere } from '@/lib/bescheid/fristen'
import { loggeFehler } from '@/lib/fehler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Vercel Cron (vercel.json, täglich 07:00 UTC = 08:00 MEZ): prüft die
 * konfigurierten Fristen-Erinnerungen und versendet sie idempotent.
 *
 * Auth: Vercel schickt `Authorization: Bearer <CRON_SECRET>`; der Secret
 * MUSS in den Env-Variablen stehen (fail-closed, sonst 503 mit Hinweis).
 * Manueller Lauf ohne Secret: Button in /admin/einstellungen.
 */
export async function GET(req: Request) {
  const erwartet = env.CRON_SECRET
  if (!erwartet) {
    return NextResponse.json(
      { ok: false, fehler: 'CRON_SECRET ist nicht gesetzt – Cron deaktiviert (fail-closed).' },
      { status: 503 },
    )
  }
  const erhalten = req.headers.get('authorization')
  if (erhalten !== `Bearer ${erwartet}`) {
    return NextResponse.json({ ok: false, fehler: 'Nicht autorisiert.' }, { status: 401 })
  }
  try {
    const erg = await pruefeUndErinnere('cron')
    return NextResponse.json({
      ok: true,
      zeitraum: erg.zeitraumErinnerungen,
      vnw: erg.vnwErinnerungen,
      mailFehler: erg.mailFehler,
      hinweis: erg.hinweis,
    })
  } catch (e) {
    loggeFehler('cron', e, { route: 'fristen' })
    return NextResponse.json({ ok: false, fehler: 'Lauf fehlgeschlagen, Details im Log.' }, { status: 500 })
  }
}
