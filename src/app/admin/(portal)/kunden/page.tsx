import type { Metadata } from 'next'

import { KundenListe } from '@/components/admin/kunden-liste'
import { listeKunden } from '@/lib/db/repositories/kunden'

export const metadata: Metadata = { title: 'Kunden | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function KundenPage() {
  const kunden = await listeKunden()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-mabe-900">Kundenübersicht ({kunden.length})</h2>
        <p className="mt-1 text-sm/6 text-olive-600">
          Alle Kunden mit mindestens einem Vorgang – gruppiert nach E-Mail-Adresse. Tippen Sie auf einen Eintrag,
          um die vollständige Fallakte aufzuklappen (Stammdaten, KMU-Verbund, De-minimis, Vollmacht, Dokumente,
          Verlauf). Über „Seite ↗“ öffnet die Akte als eigene Ansicht.
        </p>
      </div>

      {kunden.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-olive-300 p-12 text-center">
          <p className="text-olive-600">Noch keine Kunden vorhanden.</p>
        </div>
      ) : (
        <KundenListe kunden={kunden} />
      )}
    </div>
  )
}
