import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'

/**
 * Zentrale Admin-Autorisierung. Jede Admin-Seite/-Action ruft diesen Guard
 * als ERSTES auf. Liefert die Session oder leitet auf /admin/login um.
 */
export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/admin/login')
  const role = (session.user as { role?: string }).role
  if (role !== 'admin' && role !== 'vertrieb') redirect('/admin/login')
  return session
}
