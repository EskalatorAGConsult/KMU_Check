import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'

/**
 * Zentrale Admin-Autorisierung. Jede Admin-Seite/-Action ruft diesen Guard
 * als ERSTES auf. Liefert die Session oder leitet auf /admin/login um.
 * Rollen mit Admin-Zugang: 'admin' (MABE), 'eskalator' (Eskalator AG),
 * 'vertrieb' (MABE-Vertrieb). 'deaktiviert' wird immer abgelehnt.
 */
const ADMIN_ZUGANG = new Set(['admin', 'eskalator', 'vertrieb'])

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/admin/login')
  const role = (session.user as { role?: string }).role
  if (!role || !ADMIN_ZUGANG.has(role)) redirect('/admin/login')
  return session
}

/** Session des angemeldeten Nutzers oder null (ohne Redirect). */
export async function holeSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session ?? null
}

/**
 * Kunden-Autorisierung: jede /konto-Seite erfordert eine Session.
 * Liefert die Session oder leitet auf /konto/anmelden um.
 * (Vertriebsrollen duerfen das Kundenkonto ebenfalls einsehen – hilfreich
 * fuer Support; ihre Daten sehen sie weiterhin ueber /admin.
 * Deaktivierte Konten werden abgelehnt.)
 */
export async function requireKunde() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/konto/anmelden')
  const role = (session.user as { role?: string }).role
  if (role === 'deaktiviert') redirect('/konto/anmelden')
  return session
}
