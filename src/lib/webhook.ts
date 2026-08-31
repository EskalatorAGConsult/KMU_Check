/**
 * Webhook-Aufloesung: individuell in den Admin-Einstellungen (DB) gesetzte
 * URL hat Vorrang vor dem ENV-Fallback WEBHOOK_URL. Rein funktionaler Kern
 * (loeseWebhookAuf) ist separat testbar.
 */

export type WebhookQuelle = 'datenbank' | 'umgebung' | 'keine'

export interface WebhookAufloesung {
  url: string | null
  quelle: WebhookQuelle
}

/** Ermittelt die wirksame Webhook-URL aus DB-Wert und ENV-Fallback. */
export function loeseWebhookAuf(
  datenbankWert: string | null | undefined,
  envWert: string | null | undefined,
): WebhookAufloesung {
  const db = datenbankWert?.trim()
  if (db) return { url: db, quelle: 'datenbank' }
  const env = envWert?.trim()
  if (env) return { url: env, quelle: 'umgebung' }
  return { url: null, quelle: 'keine' }
}

/** Validiert eine Webhook-URL (https bzw. http nur lokal fuer Tests). */
export function istGueltigeWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol === 'https:') return true
    // http nur fuer lokale Entwicklung/Tests zulassen
    return u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)
  } catch {
    return false
  }
}
