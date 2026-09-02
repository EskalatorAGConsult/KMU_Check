import 'server-only'

import { Resend } from 'resend'

/**
 * Zentraler Resend-Client (lazy Singleton).
 * API-Key kommt aus RESEND_API_KEY (Vercel-Umgebungsvariable, fuer ALLE Mails).
 * Ohne Key liefert resendClient() null -> Aufrufer ueberspringen den Versand
 * dann still (best effort, niemals den Fachprozess blockieren).
 *
 * Absender ist einheitlich „MaBe Förderportal <MaBe-Foerderportal@automatisieren.io>"
 * (via EMAIL_FROM ueberschreibbar). Die Domain automatisieren.io ist in Resend
 * verifiziert (DNS geprueft). Perspektivisch Umstellung auf
 * foerderportal.mabe.de, sobald deren DNS-Verifizierung steht.
 */

let cached: Resend | null = null

export function resendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!cached) cached = new Resend(key)
  return cached
}

/** Einheitlicher Absender aller Portal-E-Mails (Einladung, Reset, Vollmacht, Zusammenfassung, Lead). */
export function absender(): string {
  // Zwischenloesung: automatisieren.io ist in Resend verifiziert (DNS geprueft).
  // Nach der Verifizierung von foerderportal.mabe.de auf diese Domain wechseln
  // (oder EMAIL_FROM in Vercel setzen – ueberschreibt diesen Default).
  return process.env.EMAIL_FROM ?? 'MaBe Förderportal <MaBe-Foerderportal@automatisieren.io>'
}

/** Oeffentliche Basis-URL des Portals (fuer Links in E-Mails). */
export function portalUrl(pfad = ''): string {
  const basis = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  return `${basis.replace(/\/$/, '')}${pfad}`
}
