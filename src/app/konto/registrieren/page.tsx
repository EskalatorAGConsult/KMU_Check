import type { Metadata } from 'next'

import { AuthKarte, RegistrierenForm } from '@/components/konto/auth-forms'

export const metadata: Metadata = { title: 'Registrieren | MABE Förderportal', robots: { index: false } }

export default function RegistrierenPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <div className="w-full">
        <AuthKarte
          titel="Konto anlegen"
          untertitel="Mit einem kostenlosen Konto sehen Sie jederzeit den Status Ihrer Fördervorgänge und Ihre eingereichten Angaben."
        >
          <RegistrierenForm />
        </AuthKarte>
      </div>
    </main>
  )
}
