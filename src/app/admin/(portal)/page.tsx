import type { Metadata } from 'next'
import Link from 'next/link'

import { VorgaengeListe } from '@/components/admin/vorgaenge-liste'
import { listeAngebote } from '@/lib/db/repositories/angebote'
import { ladeDashboardKennzahlen } from '@/lib/db/repositories/dashboard'
import { formatEUR } from '@/lib/kmu'

export const metadata: Metadata = { title: 'Vorgänge | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * Grosse KPI-Kachel (Hallmark: Satz-Label, grosse Zahl, klare Hierarchie).
 * Drei Varianten: normal (weiss), warnung (amber), erfolg (teal).
 */
function KachelGross({
  label,
  wert,
  hinweis,
  variante = 'normal',
  badge,
}: {
  label: string
  wert: string
  hinweis?: string
  variante?: 'normal' | 'warnung' | 'erfolg'
  badge?: string
}) {
  const rand = { normal: 'border-olive-200 bg-white', warnung: 'border-amber-300 bg-amber-50', erfolg: 'border-teal-200 bg-teal-50' }[variante]
  const zahl = { normal: 'text-mabe-900', warnung: 'text-amber-900', erfolg: 'text-teal-800' }[variante]
  const chip = { normal: 'bg-olive-100 text-olive-600', warnung: 'bg-amber-200 text-amber-800', erfolg: 'bg-teal-200 text-teal-800' }[variante]

  return (
    <div className={`flex min-h-28 flex-col justify-between rounded-2xl border p-5 sm:p-6 ${rand}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-olive-500">{label}</p>
        {badge && <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip}`}>{badge}</span>}
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums sm:text-3xl ${zahl}`}>{wert}</p>
        {hinweis && <p className="mt-1 text-xs/5 text-olive-500">{hinweis}</p>}
      </div>
    </div>
  )
}

export default async function AdminDashboard() {
  const [angebote, kpi] = await Promise.all([listeAngebote(), ladeDashboardKennzahlen()])

  return (
    <div className="flex flex-col gap-8">
      {/* ══ JETZT HANDELN ══ */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-olive-500">Jetzt handeln</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KachelGross
            label="Ohne Aufruf, über 7 Tagen"
            wert={String(kpi.ohneZugriffUeber7Tage)}
            hinweis="Kunden-Link wurde seit einer Woche nicht geöffnet."
            variante={kpi.ohneZugriffUeber7Tage > 0 ? 'warnung' : 'normal'}
            badge={kpi.ohneZugriffUeber7Tage > 0 ? 'nachfassen' : undefined}
          />
          <KachelGross
            label="Wiedervorlagen fällig"
            wert={String(kpi.ueberfaelligeWiedervorlagen)}
            hinweis="Interne Notizen mit überfälligem Datum."
            variante={kpi.ueberfaelligeWiedervorlagen > 0 ? 'warnung' : 'normal'}
            badge={kpi.ueberfaelligeWiedervorlagen > 0 ? 'dringend' : undefined}
          />
          <KachelGross
            label="Eingereicht, wartet auf Bescheid"
            wert={String(kpi.proStatus.eingereicht)}
            hinweis="Antrag beim BAFA, Bescheid noch nicht erhalten."
          />
        </div>
      </section>

      {/* ══ PIPELINE ══ */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-olive-500">Pipeline</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KachelGross
            label="Offene Vorgänge"
            wert={String(kpi.offen)}
            hinweis={`von ${kpi.vorgaengeGesamt} insgesamt`}
            variante={kpi.offen > 0 ? 'erfolg' : 'normal'}
          />
          <KachelGross
            label="Pipeline-Investition"
            wert={formatEUR(kpi.pipelineInvestEur)}
            hinweis="Summe der offenen Vorgänge"
          />
          <KachelGross
            label="Voraussichtlicher Zuschuss"
            wert={formatEUR(kpi.pipelineZuschussEur)}
            hinweis="Bei aktueller Förderquote je Vorgang"
            variante="erfolg"
          />
        </div>
      </section>

      {/* ══ VORGÄNGE ══ */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-mabe-900">Alle Vorgänge ({angebote.length})</h2>
          <a
            href="/admin/export.csv"
            className="shrink-0 rounded-xl border border-olive-300 bg-white px-4 py-2.5 text-sm font-semibold text-mabe-900 transition-colors hover:bg-olive-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90"
            title="Alle Vorgänge mit KMU-Kategorie, Förderquote und voraussichtlichem Zuschuss als CSV (Excel)"
          >
            CSV-Export
          </a>
        </div>

        {angebote.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-olive-300 p-12 text-center">
            <p className="text-olive-600">Noch keine Vorgänge. Legen Sie Ihr erstes Angebot an.</p>
            <Link
              href="/admin/angebote/neu"
              className="mt-4 inline-block rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-500 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90"
            >
              Neues Angebot anlegen
            </Link>
          </div>
        ) : (
          <VorgaengeListe angebote={angebote} />
        )}
      </section>
    </div>
  )
}
