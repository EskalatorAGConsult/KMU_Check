import type { Metadata } from 'next'
import Link from 'next/link'

import { VorgaengeListe } from '@/components/admin/vorgaenge-liste'
import { listeAngebote } from '@/lib/db/repositories/angebote'
import { ladeDashboardKennzahlen } from '@/lib/db/repositories/dashboard'
import { formatEUR } from '@/lib/kmu'

export const metadata: Metadata = { title: 'Vorgänge | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

function Kachel({
  label,
  wert,
  warnung = false,
  hinweis,
}: {
  label: string
  wert: string
  warnung?: boolean
  hinweis?: string
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 ${
        warnung ? 'border-amber-300 bg-amber-50' : 'border-olive-200 bg-white'
      }`}
      title={hinweis}
    >
      <p className={`text-[11px] font-semibold tracking-wide uppercase ${warnung ? 'text-amber-700' : 'text-olive-500'}`}>
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${warnung ? 'text-amber-900' : 'text-mabe-900'}`}>
        {wert}
      </p>
    </div>
  )
}

export default async function AdminDashboard() {
  const [angebote, kpi] = await Promise.all([listeAngebote(), ladeDashboardKennzahlen()])

  return (
    <div className="flex flex-col gap-6">
      {/* KPI-Kacheln: Arbeitsstand auf einen Blick */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kachel label="Offene Vorgänge" wert={String(kpi.offen)} hinweis={`Gesamt: ${kpi.vorgaengeGesamt}`} />
        <Kachel label="Eingereicht" wert={String(kpi.proStatus.eingereicht)} />
        <Kachel
          label="Ohne Aufruf > 7 Tage"
          wert={String(kpi.ohneZugriffUeber7Tage)}
          warnung={kpi.ohneZugriffUeber7Tage > 0}
          hinweis="Offene Vorgänge, deren Kunden-Link seit 7 Tagen nicht aufgerufen wurde – nachfassen!"
        />
        <Kachel
          label="Wiedervorlagen fällig"
          wert={String(kpi.ueberfaelligeWiedervorlagen)}
          warnung={kpi.ueberfaelligeWiedervorlagen > 0}
          hinweis="Überfällige Wiedervorlagen in den internen Notizen"
        />
        <Kachel label="Pipeline-Investition" wert={formatEUR(kpi.pipelineInvestEur)} />
        <Kachel label="Vorauss. Zuschuss" wert={formatEUR(kpi.pipelineZuschussEur)} />
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-mabe-900">Alle Vorgänge ({angebote.length})</h2>
        <a
          href="/admin/export.csv"
          className="shrink-0 rounded-lg border border-olive-300 bg-white px-3.5 py-2 text-xs font-semibold text-mabe-900 hover:bg-olive-50"
          title="Alle Vorgänge mit KMU-Kategorie, Förderquote und voraussichtlichem Zuschuss als CSV (Excel)"
        >
          ⬇ CSV-Export
        </a>
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
