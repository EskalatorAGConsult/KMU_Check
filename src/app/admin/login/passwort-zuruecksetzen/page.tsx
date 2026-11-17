import type { Metadata } from 'next'
import { Suspense } from 'react'

import { PasswortZuruecksetzenForm } from '@/components/konto/auth-forms'

export const metadata: Metadata = { title: 'Neues Passwort | MABE Förderportal', robots: { index: false } }

/**
 * Ziel des E-Mail-Links (Token via ?token=…): setzt das neue Passwort für
 * Team-Konten und leitet zurück zum Admin-Login. useSearchParams benötigt
 * im Static-Rendering eine Suspense-Grenze (gleiche Struktur wie /konto).
 */
export default function AdminPasswortZuruecksetzenPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-olive-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">MABE Förderportal</p>
        <h1 className="mt-1 mb-5 font-display text-2xl font-semibold text-mabe-900">Neues Passwort festlegen</h1>
        <Suspense fallback={<p className="text-sm/6 text-olive-500">Formular wird geladen …</p>}>
          <PasswortZuruecksetzenForm anmeldeLink="/admin/login" />
        </Suspense>
      </div>
    </main>
  )
}
