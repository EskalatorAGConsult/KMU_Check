'use client'

import { formatEUR, formatNumber, type Category, type KmuResult } from '@/lib/kmu'

/**
 * EU-KMU-Ableitung: macht die Einstufung fuer Laien transparent –
 * 1) Wie setzt sich die Verbundgröße zusammen (eigene + Partner + verbundene)?
 * 2) Wo landet der Wert auf den EU-Schwellen (2003/361/EG)?
 * 3) Warum gilt deshalb diese Kategorie (Herleitung aus der geprueften Engine)?
 * Wird direkt ueber der Ampel im KMU-Schritt angezeigt.
 */

const ZONEN: { key: Category; label: string; grenze: string }[] = [
  { key: 'kleinst', label: 'Kleinst', grenze: '< 10 JAE · ≤ 2 Mio €' },
  { key: 'klein', label: 'Klein', grenze: '< 50 JAE · ≤ 10 Mio €' },
  { key: 'mittel', label: 'Mittel', grenze: '< 250 JAE · ≤ 50/43 Mio €' },
  { key: 'gross', label: 'Groß', grenze: 'darüber' },
]

function SummenZeile({
  label,
  eigen,
  partner,
  verbunden,
  gesamt,
  format,
}: {
  label: string
  eigen: number
  partner: number
  verbunden: number
  gesamt: number
  format: (v: number) => string
}) {
  const hatVerbund = partner > 0 || verbunden > 0
  return (
    <tr className="border-t border-olive-100 first:border-t-0">
      <th scope="row" className="py-2 pr-3 text-left text-xs font-semibold text-olive-600">
        {label}
      </th>
      <td className="py-2 pr-3 text-right text-sm text-mabe-900 tabular-nums">{format(eigen)}</td>
      <td className="py-2 pr-3 text-right text-sm text-olive-600 tabular-nums">
        {hatVerbund ? `+ ${format(partner + verbunden)}` : '–'}
      </td>
      <td className="py-2 text-right text-sm font-bold text-teal-700 tabular-nums">{format(gesamt)}</td>
    </tr>
  )
}

export function KmuAbleitung({ ergebnis }: { ergebnis: KmuResult }) {
  const e = ergebnis
  const aktivZone = e.category

  return (
    <section
      aria-label="Herleitung Ihrer KMU-Einstufung"
      className="flex flex-col gap-5 rounded-2xl border border-olive-200 bg-white p-5 sm:p-6"
    >
      <div>
        <h3 className="text-base font-semibold text-mabe-900">So kommt Ihre Einstufung zustande</h3>
        <p className="mt-1 text-sm/6 text-olive-600">
          Transparent nach EU-Empfehlung 2003/361/EG: Ihre Zahlen plus die anteiligen Zahlen Ihrer Verflechtungen
          ergeben die <strong className="text-mabe-900">Verbundgröße</strong> – die wird mit den EU-Grenzen
          verglichen.
        </p>
      </div>

      {/* 1 · Die Rechnung */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse">
          <thead>
            <tr className="text-left text-[11px] font-semibold tracking-wide text-olive-400 uppercase">
              <th className="pb-1.5 pr-3">Kennzahl</th>
              <th className="pb-1.5 pr-3 text-right">Ihr Unternehmen</th>
              <th className="pb-1.5 pr-3 text-right">+ Verflechtungen</th>
              <th className="pb-1.5 text-right">= Verbundgröße</th>
            </tr>
          </thead>
          <tbody>
            <SummenZeile
              label="Beschäftigte (JAE)"
              eigen={e.own.employees}
              partner={e.partnerContribution.employees}
              verbunden={e.linkedContribution.employees}
              gesamt={e.consolidated.employees}
              format={(v) => formatNumber(v, 1)}
            />
            <SummenZeile
              label="Jahresumsatz"
              eigen={e.own.turnover}
              partner={e.partnerContribution.turnover}
              verbunden={e.linkedContribution.turnover}
              gesamt={e.consolidated.turnover}
              format={formatEUR}
            />
            <SummenZeile
              label="Bilanzsumme"
              eigen={e.own.balanceSheet}
              partner={e.partnerContribution.balanceSheet}
              verbunden={e.linkedContribution.balanceSheet}
              gesamt={e.consolidated.balanceSheet}
              format={formatEUR}
            />
          </tbody>
        </table>
        <p className="mt-2 text-[11px]/4 text-olive-500">
          Partner (25–50 %) zählen anteilig, verbundene Unternehmen (&gt; 50 %) voll – auch über mehrere Stufen.
        </p>
      </div>

      {/* 2 · EU-Schwellen: Wo landen Sie? */}
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-olive-500 uppercase">
          Ihre Position auf der EU-Skala
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="list">
          {ZONEN.map((z) => {
            const aktiv = z.key === aktivZone
            return (
              <div
                key={z.key}
                role="listitem"
                aria-current={aktiv ? 'true' : undefined}
                className={`rounded-xl border px-3 py-2.5 text-center transition-all ${
                  aktiv
                    ? 'border-teal-600 bg-teal-50 shadow-sm ring-1 ring-teal-600/40'
                    : 'border-olive-200 bg-olive-50/50'
                }`}
              >
                <p className={`text-sm font-bold ${aktiv ? 'text-teal-800' : 'text-olive-600'}`}>
                  {z.label}
                  {aktiv && (
                    <span className="ml-1" aria-hidden>
                      ◀ Sie
                    </span>
                  )}
                </p>
                <p className={`mt-0.5 text-[10px]/4 ${aktiv ? 'text-teal-700' : 'text-olive-400'}`}>{z.grenze}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3 · Herleitung in Worten (aus der Engine) */}
      <div className="rounded-xl bg-olive-50 px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-olive-500 uppercase">Herleitung</p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {e.reasons.map((r) => (
            <li key={r} className="flex gap-2 text-sm/6 text-olive-700">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px]/4 text-olive-500">
          Maßgeblich ist die Beschäftigtenzahl (verbindlich). Beim Finanzkriterium genügt Umsatz{' '}
          <em>oder</em> Bilanzsumme innerhalb der Grenze. Ein Statuswechsel wirkt förderrechtlich erst nach zwei
          aufeinanderfolgenden Geschäftsjahren.
        </p>
      </div>
    </section>
  )
}
