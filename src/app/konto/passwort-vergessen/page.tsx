import type { Metadata } from 'next'

import { AuthKarte, PasswortVergessenForm } from '@/components/konto/auth-forms'

export const metadata: Metadata = { title: 'Passwort vergessen | MABE Förderportal', robots: { index: false } }

export default function PasswortVergessenPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <div className="w-full">
        <AuthKarte
          titel="Passwort vergessen"
          untertitel="Geben Sie Ihre E-Mail-Adresse ein – wir senden Ihnen einen Link zum Zurücksetzen."
        >
          <PasswortVergessenForm />
        </AuthKarte>
      </div>
    </main>
  )
}
