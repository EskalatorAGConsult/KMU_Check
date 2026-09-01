import type { Metadata } from 'next'
import Link from 'next/link'

import { VorgaengeListe } from '@/components/admin/vorgaenge-liste'
import { listeAngebote } from '@/lib/db/repositories/angebote'

export const metadata: Metadata = { title: 'Vorgänge | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

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
        <VorgaengeListe angebote={angebote} />
      )}
    </div>
  )
}
