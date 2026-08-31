import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { VorgangAktionen } from '@/components/admin/vorgang-aktionen'
import { holeKunde } from '@/lib/db/repositories/kunden'
import type { AngebotStatus } from '@/lib/db/types'
import { CATEGORY_LABELS, type Category } from '@/lib/kmu'

export const metadata: Metadata = { title: 'Kunde | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<AngebotStatus, string> = {
  angelegt: 'Angelegt',
  eingeladen: 'Eingeladen',
  in_bearbeitung: 'In Bearbeitung',
  eingereicht: 'Eingereicht',
  abgeschlossen: 'Abgeschlossen',
  widerrufen: 'Widerrufen',
}

const STATUS_CLS: Record<AngebotStatus, string> = {
  angelegt: 'bg-olive-100 text-olive-700',
  eingeladen: 'bg-mabe-100 text-mabe-800',
  in_bearbeitung: 'bg-amber-100 text-amber-800',
  eingereicht: 'bg-teal-100 text-teal-800',
  abgeschlossen: 'bg-teal-600 text-white',
  widerrufen: 'bg-red-100 text-red-700',
}

export default async function KundeDetailPage({ params }: { params: Promise<{ email: string }> }) {
  const { email } = await params
  const kunde = await holeKunde(decodeURIComponent(email))
  if (!kunde) notFound()

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
            <span className="rounded-full bg-olive-100 px-2.5 py-1 text-xs text-olive-600">
              kein Kundenkonto
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-olive-600">{kunde.email}</p>
      </div>

      <div className="flex flex-col gap-5">
        {kunde.vorgaenge.map((v) => (
          <section key={v.angebot.id} className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-mabe-900">
                  {v.angebot.angebot_nr}
                  <span className="ml-2 text-sm font-normal text-olive-500">
                    vom {new Date(v.angebot.angebot_datum).toLocaleDateString('de-DE')}
                  </span>
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-olive-600">
                  <span>Technologien: {v.angebot.technologien.join(', ')}</span>
                  {v.kmu && (
                    <span>
                      KMU: {CATEGORY_LABELS[v.kmu.kategorie as Category] ?? v.kmu.kategorie} ·{' '}
                      {v.kmu.foerderquote_pct} %
                    </span>
                  )}
                  <span>Stammdaten: {v.hatStammdaten ? 'eingereicht' : 'offen'}</span>
                </div>
                {v.dokumente.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {v.dokumente.map((d) => (
                      <a
                        key={d.storage_path}
                        href={d.storage_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-teal-700 hover:underline"
                      >
                        {d.typ === 'systemkonzept' ? 'Systemkonzept (PDF)' : d.typ} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[v.angebot.status]}`}>
                {STATUS_LABEL[v.angebot.status]}
              </span>
            </div>
            <div className="mt-4 border-t border-olive-100 pt-4">
              <VorgangAktionen angebotId={v.angebot.id} status={v.angebot.status} />
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
