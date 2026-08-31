import type { Metadata } from 'next'
import Link from 'next/link'

import { KontoLogoutButton } from '@/components/konto/auth-forms'
import { StatusBadge } from '@/components/konto/status-badge'
import { requireKunde } from '@/lib/auth/guards'
import { listeVorgaengeFuerUser } from '@/lib/db/repositories/konto'

export const metadata: Metadata = { title: 'Mein Konto | MABE Förderportal', robots: { index: false } }

export const dynamic = 'force-dynamic'

export default async function KontoPage() {
  const session = await requireKunde()
  const vorgaenge = await listeVorgaengeFuerUser(session.user.id)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-mabe-900 sm:text-3xl">Meine Fördervorgänge</h1>
          <p className="mt-1 text-sm/6 text-olive-600">
            Angemeldet als <strong className="text-mabe-900">{session.user.email}</strong>
          </p>
        </div>
        <KontoLogoutButton />
      </header>

      {vorgaenge.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-olive-300 bg-white p-8">
          <h2 className="text-lg font-semibold text-mabe-900">Noch kein Vorgang verknüpft</h2>
          <p className="text-sm/6 text-olive-600">
            Sobald Sie Ihren persönlichen Link aus der MABE-Einladung öffnen, wird der Vorgang automatisch Ihrem
            Konto zugeordnet und erscheint hier – inklusive Status und Ihrer Angaben.
          </p>
          <p className="text-sm/6 text-olive-600">
            Keinen Link erhalten? Wenden Sie sich an Ihren MABE-Ansprechpartner.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {vorgaenge.map(({ angebot, gespeicherteSchritte, eingereichteDaten }) => (
            <li key={angebot.id}>
              <Link
                href={`/konto/vorgang/${angebot.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-olive-200 bg-white p-5 transition-colors hover:border-teal-500 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-mabe-900">{angebot.angebot_nr}</p>
                    <p className="text-sm/6 text-olive-600">
                      {angebot.kunde_firma} · Angebot vom{' '}
                      {new Date(angebot.angebot_datum).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <StatusBadge status={angebot.status} />
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-olive-100"
                    role="progressbar"
                    aria-valuenow={eingereichteDaten ? 100 : Math.round((gespeicherteSchritte / 6) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Bearbeitungsstand"
                  >
                    <div
                      className="h-full rounded-full bg-teal-600"
                      style={{ width: `${eingereichteDaten ? 100 : Math.round((gespeicherteSchritte / 6) * 100)}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-medium text-olive-500 tabular-nums">
                    {eingereichteDaten ? 'vollständig' : `${gespeicherteSchritte} von 6 Schritten`}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs/5 text-olive-500">
        Ihre Daten werden DSGVO-konform ausschließlich zur Abwicklung Ihres Förderantrags verarbeitet.
      </p>
    </main>
  )
}
