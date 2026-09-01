import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { VorgangDatenblatt } from '@/components/admin/vorgang-datenblatt'
import { listeSystemkonzeptVorlagen } from '@/lib/admin/systemkonzept-actions'
import { holeKunde } from '@/lib/db/repositories/kunden'

export const metadata: Metadata = { title: 'Kunde | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function KundeDetailPage({ params }: { params: Promise<{ email: string }> }) {
  const { email } = await params
  const kunde = await holeKunde(decodeURIComponent(email))
  if (!kunde) notFound()
  const vorlagen = await listeSystemkonzeptVorlagen()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/kunden" className="text-sm font-semibold text-teal-700 hover:underline">
          ← Alle Kunden
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-mabe-900">{kunde.firma}</h2>
          {kunde.registriert ? (
            <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">
              Kundenkonto registriert{kunde.kontoName ? ` (${kunde.kontoName})` : ''}
            </span>
          ) : (
            <span className="rounded-full bg-olive-100 px-2.5 py-1 text-xs text-olive-600">kein Kundenkonto</span>
          )}
        </div>
        <p className="mt-1 text-sm text-olive-600">
          {kunde.email} · {kunde.vorgaenge.length} {kunde.vorgaenge.length === 1 ? 'Vorgang' : 'Vorgänge'}
        </p>
        <p className="mt-2 max-w-2xl text-xs/5 text-olive-500">
          Vollständiger Datenauszug je Vorgang – in der Reihenfolge des BAFA-Modul-3-Formulars. Über „Alle
          Antragsdaten kopieren“ landet der komplette Auszug als Klartext in der Zwischenablage.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {kunde.vorgaenge.map((v, i) => (
          <div key={v.angebot.id}>
            {kunde.vorgaenge.length > 1 && (
              <p className="mb-3 text-xs font-semibold tracking-wide text-olive-500 uppercase">
                Vorgang {i + 1} von {kunde.vorgaenge.length}
              </p>
            )}
            <VorgangDatenblatt vorgang={v} vorlagen={vorlagen} />
          </div>
        ))}
      </div>
    </div>
  )
}
