'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/guards'
import { holeEinstellung, setzeEinstellung } from '@/lib/db/repositories/einstellungen'
import { audit } from '@/lib/db/repositories/journey'
import { istGueltigeWebhookUrl, loeseWebhookAuf } from '@/lib/webhook'

export type EinstellungErgebnis = { ok: true; hinweis?: string } | { ok: false; fehler: string }

/** Speichert die individuelle Webhook-URL (leer = DB-Wert loeschen, ENV-Fallback aktiv). */
export async function speichereWebhookUrl(url: string): Promise<EinstellungErgebnis> {
  const session = await requireAdmin()
  const bereinigt = url.trim()

  if (bereinigt && !istGueltigeWebhookUrl(bereinigt)) {
    return { ok: false, fehler: 'Ungültige URL. Erlaubt ist https:// (http nur lokal für Tests).' }
  }

  try {
    // Leere Eingabe loescht den DB-Wert nicht physisch, sondern setzt ihn auf
    // '' – die Aufloesung (loeseWebhookAuf) faellt dann auf ENV zurueck.
    await setzeEinstellung('webhook_url', bereinigt, session.user.id)
    await audit(null, `admin:${session.user.id}`, 'einstellung_webhook_url', {
      gesetzt: !!bereinigt,
    })
    revalidatePath('/admin/einstellungen')
    return {
      ok: true,
      hinweis: bereinigt
        ? 'Webhook-URL gespeichert und sofort aktiv.'
        : 'Individuelle URL entfernt – es gilt wieder der ENV-Fallback (WEBHOOK_URL).',
    }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.' }
  }
}

export type WebhookTestErgebnis =
  | { ok: true; status: number; quelle: string }
  | { ok: false; fehler: string }

/** Sendet einen Ping an die wirksame Webhook-URL (DB oder ENV). */
export async function testeWebhook(): Promise<WebhookTestErgebnis> {
  const session = await requireAdmin()

  let dbWert: string | null = null
  try {
    dbWert = await holeEinstellung('webhook_url')
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Einstellung nicht lesbar.' }
  }
  const { url, quelle } = loeseWebhookAuf(dbWert, process.env.WEBHOOK_URL)
  if (!url) {
    return { ok: false, fehler: 'Keine Webhook-URL konfiguriert (weder in den Einstellungen noch als ENV).' }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'webhook_test',
        quelle,
        ausgeloest_von: session.user.email,
        at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    await audit(null, `admin:${session.user.id}`, 'webhook_test', { status: res.status, quelle })
    if (!res.ok) return { ok: false, fehler: `Webhook antwortete mit HTTP ${res.status}.` }
    return { ok: true, status: res.status, quelle }
  } catch (e) {
    await audit(null, `admin:${session.user.id}`, 'webhook_test', {
      fehler: e instanceof Error ? e.message : String(e),
      quelle,
    })
    return { ok: false, fehler: 'Webhook nicht erreichbar (Timeout oder Netzwerkfehler).' }
  }
}
