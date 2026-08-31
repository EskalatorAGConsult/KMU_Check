import type { Metadata } from 'next'

import { AnmeldenForm, AuthKarte } from '@/components/konto/auth-forms'

export const metadata: Metadata = { title: 'Anmelden | MABE Förderportal', robots: { index: false } }

export default function AnmeldenPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <div className="w-full">
        <AuthKarte
          titel="Anmelden"
          untertitel="Melden Sie sich an, um den Status Ihrer Fördervorgänge und Ihre eingereichten Angaben einzusehen."
        >
          <AnmeldenForm />
        </AuthKarte>
      </div>
    </main>
  )
}
