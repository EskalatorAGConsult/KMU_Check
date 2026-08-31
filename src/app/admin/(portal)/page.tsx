import type { Metadata } from 'next'
import Link from 'next/link'

import { listeAngebote } from '@/lib/db/repositories/angebote'
import type { AngebotStatus } from '@/lib/db/types'

export const metadata: Metadata = { title: 'Vorgänge | MABE Förderportal', robots: { index: false } }
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

export default async function AdminDashboard() {
  const angebote = await listeAngebote()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-mabe-900">Alle Vorgänge ({angebote.length})</h2>
      </div>

      {angebote.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-olive-300 p-12 text-center">
          <p className="text-olive-600">Noch keine Vorgänge. Legen Sie Ihr erstes Angebot an.</p>
          <Link
            href="/admin/angebote/neu"
            className="mt-4 inline-block rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-500"
          >
            + Neues Angebot
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl ring-1 ring-olive-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-olive-50 text-olive-500">
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Kunde</th>
                <th className="px-5 py-3.5 font-semibold">Angebot</th>
                <th className="px-5 py-3.5 font-semibold">Angelegt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-olive-100 bg-white">
              {angebote.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-mabe-900">{a.kunde_firma}</div>
                    <div className="text-xs text-olive-500">{a.kunde_email}</div>
                  </td>
                  <td className="px-5 py-3.5 text-olive-700">
                    {a.angebot_nr}
                    <span className="text-olive-400"> · {new Date(a.angebot_datum).toLocaleDateString('de-DE')}</span>
                  </td>
                  <td className="px-5 py-3.5 text-olive-500">
                    {new Date(a.created_at).toLocaleDateString('de-DE')}
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
