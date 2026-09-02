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

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

/**
 * Sendet eine Test-Mail an den angemeldeten Admin (verifiziert Resend-Key,
 * Absender-Adresse und Domain-Verifizierung end-to-end). Der tatsaechliche
 * Fehlergrund wird zurueckgegeben statt verschluckt.
 */
export async function testeEmailVersand(): Promise<EinstellungErgebnis> {
  const session = await requireAdmin()
  try {
    const { sendeTestMail } = await import('@/lib/email/notify')
    const versand = await sendeTestMail(session.user.email)
    await audit(null, `admin:${session.user.id}`, 'email_versand_test', {
      ok: versand.ok,
      grund: versand.grund ?? null,
    })
    return versand.ok
      ? { ok: true, hinweis: `Test-Mail an ${session.user.email} gesendet – bitte Posteingang prüfen (auch Spam).` }
      : { ok: false, fehler: `Versand fehlgeschlagen: ${versand.grund ?? 'unbekannt'}` }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Testversand fehlgeschlagen.' }
  }
}

/** Speichert die Empfaenger der Lead-Benachrichtigung (Komma/Semikolon-getrennt; leer = Standard). */
export async function speichereLeadEmpfaenger(wert: string): Promise<EinstellungErgebnis> {
  const session = await requireAdmin()
  const adressen = wert
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)

  const ungueltig = adressen.filter((a) => !EMAIL_RE.test(a))
  if (ungueltig.length > 0) {
    return { ok: false, fehler: `Ungültige E-Mail-Adresse(n): ${ungueltig.join(', ')}` }
  }

  try {
    await setzeEinstellung('lead_email_empfaenger', adressen.join(', '), session.user.id)
    await audit(null, `admin:${session.user.id}`, 'einstellung_lead_empfaenger', {
      anzahl: adressen.length,
    })
    revalidatePath('/admin/einstellungen')
    return {
      ok: true,
      hinweis:
        adressen.length > 0
          ? `Lead-Benachrichtigung geht jetzt an: ${adressen.join(', ')}`
          : 'Empfänger zurückgesetzt – es gilt der Standard (robin@eskalator.ag) bzw. ENV-Fallback.',
    }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.' }
  }
}
