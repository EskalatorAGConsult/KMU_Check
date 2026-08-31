import 'server-only'

import { Resend } from 'resend'

/**
 * Zentraler Resend-Client (lazy Singleton).
 * API-Key kommt aus RESEND_API_KEY (Vercel: RESEND_API wird als Fallback akzeptiert).
 * Ohne Key liefert resendClient() null -> Aufrufer ueberspringen den Versand
 * dann still (best effort, niemals den Fachprozess blockieren).
 *
 * Absender via EMAIL_FROM konfigurierbar; die Domain muss in Resend
 * verifiziert sein (sonst Zustellfehler, wird nur geloggt).
 */

let cached: Resend | null = null

export function resendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY ?? process.env.RESEND_API
  if (!key) return null
  if (!cached) cached = new Resend(key)
  return cached
}

export function absender(): string {
  return process.env.EMAIL_FROM ?? 'MABE Förderportal <mabe@automatisieren.io>'
}

/** Oeffentliche Basis-URL des Portals (fuer Links in E-Mails). */
export function portalUrl(pfad = ''): string {
  const basis = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  return `${basis.replace(/\/$/, '')}${pfad}`
}
