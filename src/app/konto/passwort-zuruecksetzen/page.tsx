import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AuthKarte, PasswortZuruecksetzenForm } from '@/components/konto/auth-forms'

export const metadata: Metadata = { title: 'Neues Passwort | MABE Förderportal', robots: { index: false } }

export default function PasswortZuruecksetzenPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <div className="w-full">
        <AuthKarte titel="Neues Passwort festlegen" untertitel="Ihr neues Passwort muss mindestens 12 Zeichen lang sein.">
          <Suspense>
            <PasswortZuruecksetzenForm />
          </Suspense>
        </AuthKarte>
      </div>
    </main>
  )
}
