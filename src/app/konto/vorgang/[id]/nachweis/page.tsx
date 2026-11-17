import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { NachweisManager } from '@/components/bescheid/nachweis-manager'
import { holeSession } from '@/lib/auth/guards'
import { NachweisKontext } from '@/lib/bescheid/domain'
import { holeBescheidBundle, holeVerwendungsnachweis, listeVnwBelege } from '@/lib/db/repositories/bescheid'
import { supabaseServer } from '@/lib/db/server'

export const metadata: Metadata = { title: 'Verwendungsnachweis | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * Verwendungsnachweis-Station: aktiviert sich mit dem hochgeladenen
 * Zuwendungsbescheid (Domänen-Regel NachweisKontext.stationenAktiv).
 * Ohne Bescheid: Hinweiskarte mit Link zur Bescheid-Seite (kein totes Formular).
 */
export default async function NachweisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await holeSession()
  if (!session?.user) notFound()

  const { data: zugriff } = await supabaseServer()
    .from('angebot_zugriffe')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('angebot_id', id)
    .maybeSingle()
  if (!zugriff) notFound()

  const { data: angebot } = await supabaseServer()
    .from('angebote')
    .select('id, angebot_nr, kunde_firma')
    .eq('id', id)
    .maybeSingle()
  if (!angebot) notFound()

  const [bundle, vnw, belege] = await Promise.all([
    holeBescheidBundle(id),
    holeVerwendungsnachweis(id),
    listeVnwBelege(id),
  ])
  const kontext = new NachweisKontext({ bescheid: bundle?.bescheid ?? null, vnw: vnw ?? null, belege })

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href={`/konto/vorgang/${id}`} className="text-sm font-semibold text-teal-700 hover:underline">
        ← Zurück zum Vorgang
      </Link>

      <header className="mt-4 mb-8">
        <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">Letzter Schritt zur Auszahlung</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-mabe-900 sm:text-3xl">Verwendungsnachweis</h1>
        <p className="mt-2 text-sm/6 text-olive-600">
          <strong className="text-mabe-900">{angebot.angebot_nr}</strong> · {angebot.kunde_firma}
        </p>
        <p className="mt-3 max-w-xl text-sm/6 text-olive-600">
          Mit dem Verwendungsnachweis belegen Sie, dass die Maßnahme wie bewilligt umgesetzt wurde – Rechnungen,
          Zahlungen und ein kurzer Sachbericht. Erst danach zahlt das BAFA den Zuschuss aus.
        </p>
      </header>

      {kontext.stationenAktiv ? (
        <NachweisManager
          angebotId={id}
          vnw={vnw}
          belege={belege}
          frist={kontext.frist}
          belegSummeEur={kontext.belegSummeEur}
          fehlendeBausteine={kontext.fehlendeBausteine}
          darfEinreichen={kontext.darfEinreichen}
        />
      ) : (
        <section className="rounded-2xl border border-dashed border-olive-300 bg-white p-8 text-center">
          <p className="text-base font-semibold text-mabe-900">Noch ohne Zuwendungsbescheid</p>
          <p className="mx-auto mt-2 max-w-md text-sm/6 text-olive-600">
            Diese Station wird aktiv, sobald der Zuwendungsbescheid hochgeladen ist – dann erscheinen hier
            Durchführungszeitraum, Vorlagefrist und die Belegsammlung.
          </p>
          <Link
            href={`/konto/vorgang/${id}/bescheid`}
            className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-500"
          >
            Zum Zuwendungsbescheid →
          </Link>
        </section>
      )}
    </main>
  )
}
