import 'server-only'

import { Resend } from 'resend'

/**
 * Zentraler Resend-Client (lazy Singleton).
 * API-Key kommt aus RESEND_API_KEY (Vercel-Umgebungsvariable, fuer ALLE Mails).
 * Ohne Key liefert resendClient() null -> Aufrufer ueberspringen den Versand
 * dann still (best effort, niemals den Fachprozess blockieren).
 *
 * Absender ist einheitlich „MaBe Förderportal <no-reply@foerderportal.mabe.de>"
 * (via EMAIL_FROM ueberschreibbar). Voraussetzung: Die Subdomain
 * foerderportal.mabe.de ist im Resend-Konto (mabe.de-API-Key) als eigene
 * Domain angelegt und DNS-verifiziert (SPF/DKIM) – sonst lehnt Resend mit
 * „domain is not verified" (403) ab.
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
  // Absender-Domain foerderportal.mabe.de (Resend-Konto mabe.de); ueber
  // EMAIL_FROM in Vercel uebersteuerbar (muss auf einer verifizierten
  // Domain liegen, sonst 403 from_address_unauthorized).
  return process.env.EMAIL_FROM ?? 'MaBe Förderportal <no-reply@foerderportal.mabe.de>'
}

/** Oeffentliche Basis-URL des Portals (fuer Links in E-Mails). */
export function portalUrl(pfad = ''): string {
  const basis = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  return `${basis.replace(/\/$/, '')}${pfad}`
}
