import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'

import { Wizard } from '@/components/journey/wizard'
import { holeSession } from '@/lib/auth/guards'
import { holeFortschritt, protokolliereZugriff, validiereToken } from '@/lib/db/repositories/journey'
import { verknuepfeZugriff } from '@/lib/db/repositories/konto'
import { formatEUR } from '@/lib/kmu'

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
        <h1 className="font-display text-2xl font-semibold text-mabe-900 sm:text-3xl">
          Dieser Link ist nicht mehr gültig.
        </h1>
        <p className="text-sm/6 text-olive-600 sm:text-base/7">
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

  // Zugriffsprotokoll (Migration 20): jeder Aufruf des persoenlichen Links
  // wird mit Zeit, IP und Geraet festgehalten – best effort, blockiert nie.
  try {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip')
    await protokolliereZugriff(angebot.id, kontext.token.id, ip ?? null, h.get('user-agent'))
  } catch (e) {
    console.error('[journey] Zugriffsprotokoll fehlgeschlagen:', e)
  }

  // Auto-Claim: Ist der Kunde eingeloggt, wird der Vorgang still seinem
  // Konto zugeordnet – er sieht ihn dann unter /konto.
  const session = await holeSession()
  if (session?.user) {
    try {
      await verknuepfeZugriff(session.user.id, angebot.id)
    } catch (e) {
      console.error('[journey] Auto-Claim fehlgeschlagen:', e)
    }
  }

  if (angebot.status === 'eingereicht' || angebot.status === 'abgeschlossen') {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-mabe-900 sm:text-3xl">
          Dieser Vorgang ist bereits eingereicht.
        </h1>
        <p className="text-sm/6 text-olive-600 sm:text-base/7">
          Ihre Angaben zum Vorgang <strong className="text-mabe-900">{angebot.angebot_nr}</strong> liegen vollständig
          vor. Bei Änderungswünschen wenden Sie sich bitte an Ihren MABE-Ansprechpartner.
        </p>
      </main>
    )
  }

  const fortschritt = await holeFortschritt(angebot.id)
  const investSumme =
    (angebot.invest_software ?? 0) + (angebot.invest_messtechnik ?? 0) + (angebot.invest_steuerung ?? 0)

  return (
    <main className="mx-auto w-full max-w-3xl overflow-x-clip px-4 pt-0 pb-10 sm:px-6 2xl:max-w-6xl">
      <div className="2xl:grid 2xl:grid-cols-[minmax(0,1fr)_300px] 2xl:items-start 2xl:gap-12">
        <div className="min-w-0">
          <p className="pt-5 pb-1 text-xs/5 text-olive-500 sm:pt-7 sm:text-sm/6">
            Förderprojekt für <strong className="text-mabe-900">{angebot.kunde_firma}</strong> · Angebot{' '}
            {angebot.angebot_nr}
          </p>
          <Wizard
            token={token}
            angebot={angebot}
            initialDaten={fortschritt?.schritte ?? {}}
            startSchritt={fortschritt?.aktueller_schritt ?? 'uebersicht'}
          />
        </div>

        {/* Kontext-Sidebar: nur auf sehr breiten Viewports (16:9 gross / 21:9) */}
        <aside className="sticky top-6 mt-7 hidden flex-col gap-4 2xl:flex">
          <div className="rounded-2xl border border-olive-200 bg-white p-5">
            <p className="text-xs font-semibold tracking-wide text-olive-500 uppercase">Ihr Vorhaben</p>
            <p className="mt-2 text-sm font-semibold text-mabe-900">{angebot.angebot_nr}</p>
            <p className="text-sm/6 text-olive-600">{angebot.kunde_firma}</p>
            {investSumme > 0 && (
              <dl className="mt-3 flex flex-col gap-1.5 border-t border-olive-100 pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-olive-600">Investition</dt>
                  <dd className="font-medium text-mabe-900 tabular-nums">{formatEUR(investSumme)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-olive-600">Zuschuss bis zu</dt>
                  <dd className="font-semibold text-teal-700 tabular-nums">{formatEUR(investSumme * 0.45)}</dd>
                </div>
              </dl>
            )}
          </div>

          <div className="rounded-2xl bg-mabe-900 p-5 text-white">
            <p className="text-sm font-semibold">Fragen zwischendurch?</p>
            <p className="mt-1.5 text-sm/6 text-olive-200">
              {angebot.kunde_ansprechpartner
                ? `Ihr Ansprechpartner ${angebot.kunde_ansprechpartner} hilft gerne weiter.`
                : 'Ihr MABE-Ansprechpartner hilft Ihnen gerne weiter.'}{' '}
              Sie können jederzeit speichern und später fortsetzen.
            </p>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-olive-200 bg-olive-50/60 p-4">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="mt-0.5 size-4 shrink-0 text-teal-700"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs/5 text-olive-600">
              Ihre Daten werden verschlüsselt übertragen und DSGVO-konform ausschließlich zur Abwicklung Ihres
              Förderantrags verarbeitet.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}
