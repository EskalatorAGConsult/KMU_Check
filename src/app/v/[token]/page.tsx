import type { Metadata } from 'next'
import Link from 'next/link'

import { Wizard } from '@/components/journey/wizard'
import { holeFortschritt, validiereToken } from '@/lib/db/repositories/journey'

export const metadata: Metadata = {
  title: 'Ihr Förderprojekt | MABE',
  robots: { index: false, follow: false }, // persoenlicher Link, nicht oeffentlich
}

export default async function JourneyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const kontext = await validiereToken(token)

  if (!kontext) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold text-mabe-900">Dieser Link ist nicht mehr gültig.</h1>
        <p className="text-olive-600">
          Er ist abgelaufen oder wurde widerrufen. Bitte wenden Sie sich an Ihren Ansprechpartner bei MABE – Sie
          erhalten umgehend einen neuen Link.
        </p>
        <Link href="/" className="text-sm font-semibold text-teal-700 hover:underline">
          Zur Startseite
        </Link>
      </main>
    )
  }

  const { angebot } = kontext

  if (angebot.status === 'eingereicht' || angebot.status === 'abgeschlossen') {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold text-mabe-900">Dieser Vorgang ist bereits eingereicht.</h1>
        <p className="text-olive-600">
          Ihre Angaben zum Vorgang <strong className="text-mabe-900">{angebot.angebot_nr}</strong> liegen vollständig
          vor. Bei Änderungswünschen wenden Sie sich bitte an Ihren MABE-Ansprechpartner.
        </p>
      </main>
    )
  }

  const fortschritt = await holeFortschritt(angebot.id)

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <p className="mb-6 text-sm text-olive-500">
        Förderprojekt für <strong className="text-mabe-900">{angebot.kunde_firma}</strong> · Angebot{' '}
        {angebot.angebot_nr}
      </p>
      <Wizard
        token={token}
        angebot={angebot}
        initialDaten={fortschritt?.schritte ?? {}}
        startSchritt={fortschritt?.aktueller_schritt ?? 'uebersicht'}
      />
    </main>
  )
}
