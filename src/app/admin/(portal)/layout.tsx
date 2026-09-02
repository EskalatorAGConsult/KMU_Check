import Link from 'next/link'

import { LogoutButton } from '@/components/admin/logout-button'
import { requireAdmin } from '@/lib/auth/guards'

/**
 * Geschuetzter Admin-Bereich (Route Group „portal“): das Layout erzwingt
 * die Session fuer ALLE darunterliegenden Seiten.
 * Mobile: Brand + Abmelden oben, Navigation als horizontal scrollbare
 * Pill-Leiste (Daumen-reichweite, keine umbrechenden Mini-Links).
 */
const NAV_LINK = 'inline-flex min-h-10 items-center rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap'

/**
 * Kontakt-Zeile im Admin-Header: fest hinterlegte Vertriebs-Adresse (Wunsch
 * 02.09.2026) – bewusst NICHT die Login-Adresse der jeweiligen Session.
 */
const HEADER_KONTAKT = 'm.dick@mabe.de'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 border-b border-olive-200 pb-5 sm:mb-10 sm:pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">MABE Förderportal</p>
            <h1 className="mt-1 font-display text-xl font-semibold text-mabe-900 sm:text-2xl">Vertriebsbereich</h1>
            <p className="mt-0.5 max-w-full truncate text-xs text-olive-500">{HEADER_KONTAKT}</p>
          </div>
          <LogoutButton />
        </div>

        {/* Navigation: auf kleinen Viewports horizontal scrollbar, nichts bricht um */}
        <nav aria-label="Admin-Bereich" className="-mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
          <div className="flex items-center gap-1.5">
            <Link href="/admin" className={`${NAV_LINK} text-olive-700 hover:bg-olive-100 hover:text-mabe-900`}>
              Vorgänge
            </Link>
            <Link href="/admin/kunden" className={`${NAV_LINK} text-olive-700 hover:bg-olive-100 hover:text-mabe-900`}>
              Kunden
            </Link>
            <Link href="/admin/benutzer" className={`${NAV_LINK} text-olive-700 hover:bg-olive-100 hover:text-mabe-900`}>
              Benutzer
            </Link>
            <Link
              href="/admin/einstellungen"
              className={`${NAV_LINK} text-olive-700 hover:bg-olive-100 hover:text-mabe-900`}
            >
              Einstellungen
            </Link>
            <Link
              href="/admin/angebote/neu"
              className={`${NAV_LINK} ml-1 bg-teal-600 text-white hover:bg-teal-500`}
            >
              + Neues Angebot
            </Link>
          </div>
        </nav>
      </header>
      {children}
    </div>
  )
}
