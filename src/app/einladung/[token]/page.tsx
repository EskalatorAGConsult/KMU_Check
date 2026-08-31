import type { Metadata } from 'next'
import Link from 'next/link'

import { EinladungForm } from '@/components/einladung/form'
import { ROLLEN_LABEL } from '@/lib/admin/rollen'
import { validiereEinladungsToken } from '@/lib/db/repositories/benutzer'

export const metadata: Metadata = { title: 'Einladung | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function EinladungPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const einladung = await validiereEinladungsToken(token)

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-olive-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">MABE Förderportal</p>
        {einladung ? (
          <>
            <h1 className="mt-1 mb-5 font-display text-2xl font-semibold text-mabe-900">Konto anlegen</h1>
            <EinladungForm
              token={token}
              email={einladung.email}
              rolleLabel={ROLLEN_LABEL[einladung.rolle] ?? einladung.rolle}
            />
          </>
        ) : (
          <>
            <h1 className="mt-1 mb-3 font-display text-2xl font-semibold text-mabe-900">Link ungültig</h1>
            <p className="text-sm/6 text-olive-600">
              Dieser Einladungslink ist ungültig, abgelaufen oder wurde bereits verwendet. Bitte wenden Sie sich
              an die Person, die Sie eingeladen hat, um einen neuen Link zu erhalten.
            </p>
            <Link href="/admin/login" className="mt-5 inline-block text-sm font-semibold text-teal-700 hover:underline">
              Zur Anmeldung →
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
