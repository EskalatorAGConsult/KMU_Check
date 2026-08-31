import Link from 'next/link'

import { LogoutButton } from '@/components/admin/logout-button'
import { requireAdmin } from '@/lib/auth/guards'

/**
 * Geschuetzter Admin-Bereich (Route Group „portal“): das Layout erzwingt
 * die Session fuer ALLE darunterliegenden Seiten.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-olive-200 pb-6">
        <div>
          <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">MABE Förderportal</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-mabe-900">Vertriebsbereich</h1>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/admin" className="text-sm font-semibold text-olive-700 hover:text-mabe-900">
            Vorgänge
          </Link>
          <Link href="/admin/kunden" className="text-sm font-semibold text-olive-700 hover:text-mabe-900">
            Kunden
          </Link>
          <Link href="/admin/benutzer" className="text-sm font-semibold text-olive-700 hover:text-mabe-900">
            Benutzer
          </Link>
          <Link href="/admin/einstellungen" className="text-sm font-semibold text-olive-700 hover:text-mabe-900">
            Einstellungen
          </Link>
          <Link
            href="/admin/angebote/neu"
            className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
          >
            + Neues Angebot
          </Link>
          <span className="text-xs text-olive-500">{session.user.email}</span>
          <LogoutButton />
        </nav>
      </header>
      {children}
    </div>
  )
}
