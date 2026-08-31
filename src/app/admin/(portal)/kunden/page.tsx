import type { Metadata } from 'next'
import Link from 'next/link'

import { listeKunden } from '@/lib/db/repositories/kunden'
import type { AngebotStatus } from '@/lib/db/types'

export const metadata: Metadata = { title: 'Kunden | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

const STATUS_KURZ: Record<AngebotStatus, string> = {
  angelegt: 'Angelegt',
  eingeladen: 'Eingeladen',
  in_bearbeitung: 'In Bearb.',
  eingereicht: 'Eingereicht',
  abgeschlossen: 'Abgeschl.',
  widerrufen: 'Widerrufen',
}

export default async function KundenPage() {
  const kunden = await listeKunden()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-mabe-900">Kundenübersicht ({kunden.length})</h2>
        <p className="mt-1 text-sm/6 text-olive-600">
          Alle Kunden mit mindestens einem Vorgang – gruppiert nach E-Mail-Adresse.
        </p>
      </div>

      {kunden.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-olive-300 p-12 text-center">
          <p className="text-olive-600">Noch keine Kunden vorhanden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-olive-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-olive-50 text-olive-500">
                <th className="px-5 py-3.5 font-semibold">Kunde</th>
                <th className="px-5 py-3.5 font-semibold">Vorgänge</th>
                <th className="px-5 py-3.5 font-semibold">Kundenkonto</th>
                <th className="px-5 py-3.5 font-semibold">Letzter Vorgang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-olive-100 bg-white">
              {kunden.map((k) => (
                <tr key={k.email} className="hover:bg-olive-50/50">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/kunden/${encodeURIComponent(k.email)}`}
                      className="font-medium text-teal-700 hover:underline"
                    >
                      {k.firma}
                    </Link>
                    <div className="text-xs text-olive-500">{k.email}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-mabe-900 tabular-nums">{k.anzahlVorgaenge}</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {[...new Set(k.status)].map((s) => (
                        <span key={s} className="rounded-full bg-olive-100 px-2 py-0.5 text-[11px] text-olive-700">
                          {STATUS_KURZ[s]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {k.registriert ? (
                      <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">
                        registriert
                      </span>
                    ) : (
                      <span className="rounded-full bg-olive-100 px-2.5 py-1 text-xs text-olive-600">
                        nicht registriert
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-olive-500">
                    {new Date(k.letzterVorgang).toLocaleDateString('de-DE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
