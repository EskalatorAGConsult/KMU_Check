import type { Metadata } from 'next'
import Link from 'next/link'

import { PasswortVergessenForm } from '@/components/konto/auth-forms'

export const metadata: Metadata = { title: 'Passwort zurücksetzen | MABE Förderportal', robots: { index: false } }

/**
 * Passwort-Reset für Team-Konten (Admin-/Vertriebs-Login). Liegt bewusst
 * UNTERHALB von /admin/login, also außerhalb der geschützten (portal)-Gruppe.
 * Token-Verwahrung: Better-Auth-Tabelle `verification` (Supabase), Versand
 * über Resend (`sendePasswortReset`), Link-Dauer 1 Stunde.
 */
export default function AdminPasswortVergessenPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-olive-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">MABE Förderportal</p>
        <h1 className="mt-1 mb-5 font-display text-2xl font-semibold text-mabe-900">Passwort zurücksetzen</h1>
        <p className="mb-5 text-sm/6 text-olive-600">
          Für Ihr Team-Konto im Vertriebsbereich. Wir senden Ihnen einen Link zum Setzen eines neuen Passworts
          (1 Stunde gültig).
        </p>
        <PasswortVergessenForm
          redirectTo="/admin/login/passwort-zuruecksetzen"
          anmeldeLink="/admin/login"
        />
        <p className="mt-4 text-center text-sm">
          <Link href="/admin/login" className="font-medium text-teal-700 hover:underline">
            Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </main>
  )
}
