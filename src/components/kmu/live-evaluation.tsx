'use client'

import { clsx } from 'clsx/lite'
import type { Category, KmuResult } from '@/lib/kmu'
import { formatEUR, formatNumber } from '@/lib/kmu'

const CATEGORY_THRESHOLDS: Record<Exclude<Category, 'gross'>, { emp: number; fin: number }> = {
  kleinst: { emp: 10, fin: 2_000_000 },
  klein: { emp: 50, fin: 10_000_000 },
  mittel: { emp: 250, fin: 50_000_000 },
}

const CATEGORY_STYLE: Record<Category, { ring: string; text: string; bg: string; dot: string; label: string }> = {
  kleinst: { ring: 'ring-teal-600/30', text: 'text-teal-800', bg: 'bg-teal-50', dot: 'bg-teal-500', label: 'KMU' },
  klein: { ring: 'ring-teal-600/30', text: 'text-teal-800', bg: 'bg-teal-50', dot: 'bg-teal-500', label: 'KMU' },
  mittel: { ring: 'ring-mabe-600/30', text: 'text-mabe-800', bg: 'bg-mabe-50', dot: 'bg-mabe-600', label: 'KMU' },
  gross: { ring: 'ring-amber-600/30', text: 'text-amber-800', bg: 'bg-amber-50', dot: 'bg-amber-500', label: 'Kein KMU' },
}

function Bar({ value, threshold, format }: { value: number; threshold: number; format: (n: number) => string }) {
  const pct = Math.min(100, threshold > 0 ? (value / threshold) * 100 : 0)
  const over = value > threshold
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-olive-950 tabular-nums">{format(value)}</span>
        <span className="text-olive-500 tabular-nums">Grenze {format(threshold)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-olive-200">
        <div
          className={clsx('h-full rounded-full transition-all duration-700 ease-out', over ? 'bg-amber-500' : 'bg-teal-500')}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  )
}

const FUNDING_STOPS = [
  { rate: 25, label: 'Kein KMU' },
  { rate: 35, label: 'Mittel' },
  { rate: 45, label: 'Klein' },
]

export function FundingScale({ activeRate }: { activeRate: number }) {
  return (
    <div>
      <div className="relative flex h-3 overflow-hidden rounded-full">
        <div className="flex-1 bg-olive-300" />
        <div className="flex-1 bg-mabe-300" />
        <div className="flex-1 bg-teal-400" />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {FUNDING_STOPS.map((s) => {
          const active = s.rate === activeRate
          return (
            <div
              key={s.rate}
              className={clsx(
                'rounded-lg px-1 py-1.5 text-center transition',
                active ? 'bg-olive-950 text-white shadow-sm' : 'text-olive-500',
              )}
            >
              <div className="text-base font-bold tabular-nums">{s.rate} %</div>
              <div className="text-[11px] leading-tight">{s.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LiveEvaluation({
  result,
  hasInput,
  className,
}: {
  result: KmuResult | null
  hasInput: boolean
  className?: string
}) {
  const style = result ? CATEGORY_STYLE[result.category] : CATEGORY_STYLE.klein
  const t = result && result.category !== 'gross' ? CATEGORY_THRESHOLDS[result.category] : CATEGORY_THRESHOLDS.mittel
  const hasVerbund =
    !!result &&
    (result.partnerContribution.employees > 0 ||
      result.linkedContribution.employees > 0 ||
      result.partnerContribution.turnover > 0 ||
      result.linkedContribution.turnover > 0 ||
      result.partnerContribution.balanceSheet > 0 ||
      result.linkedContribution.balanceSheet > 0)

  return (
    <div
      className={clsx(
        'flex flex-col gap-6 rounded-3xl border border-olive-200 bg-white p-6 shadow-sm sm:p-8',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-teal-500" />
          </span>
          <h3 className="text-sm font-semibold tracking-wide text-olive-600 uppercase">Ihr KMU-Status · live</h3>
        </div>
      </div>

      {/* Kategorie-Badge */}
      <div className={clsx('flex items-center gap-3 rounded-2xl p-4 ring-1', style.bg, style.ring)}>
        <span className={clsx('flex size-3 shrink-0 rounded-full', style.dot)} />
        <div className="min-w-0">
          <div className={clsx('text-lg font-bold', style.text)}>
            {hasInput && result ? result.categoryLabel : 'Noch keine Eingabe'}
          </div>
          <div className="text-sm text-olive-600">
            {hasInput && result
              ? result.isKmu
                ? 'Erfüllt die EU-KMU-Kriterien (2003/361/EG).'
                : 'Überschreitet die KMU-Schwellenwerte.'
              : 'Beantworten Sie die Fragen – die Auswertung erscheint sofort.'}
          </div>
        </div>
      </div>

      {/* Förderquote */}
      <div>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold tracking-wide text-olive-500 uppercase">
              Mögliche Förderquote · BAFA Modul 3
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-5xl text-mabe-900 tabular-nums">
                {hasInput && result ? result.fundingRatePct : '—'}
              </span>
              <span className="text-2xl font-semibold text-olive-500">%</span>
            </div>
          </div>
          <div className="max-w-[9rem] text-right text-xs leading-snug text-olive-500">
            der förderfähigen Investitionskosten
          </div>
        </div>
        <FundingScale activeRate={hasInput && result ? result.fundingRatePct : -1} />
      </div>

      {/* Konsolidierte Werte vs. Schwellenwerte */}
      <div className="flex flex-col gap-4 border-t border-olive-100 pt-5">
        <div className="text-xs font-semibold tracking-wide text-olive-500 uppercase">
          {hasVerbund ? 'Konsolidierte (fiktive) Verbundwerte' : 'Ihre Unternehmenswerte'}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-medium text-olive-600">Beschäftigte (Jahresarbeitseinheiten)</div>
          <Bar value={result?.consolidated.employees ?? 0} threshold={t.emp} format={(n) => formatNumber(n, 1)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-medium text-olive-600">Jahresumsatz</div>
          <Bar value={result?.consolidated.turnover ?? 0} threshold={t.fin} format={formatEUR} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-medium text-olive-600">Bilanzsumme</div>
          <Bar
            value={result?.consolidated.balanceSheet ?? 0}
            threshold={result?.category === 'mittel' ? 43_000_000 : t.fin}
            format={formatEUR}
          />
        </div>
      </div>

      {/* Verbund-Aufschlüsselung */}
      {hasVerbund && result && (
        <div className="rounded-2xl bg-olive-50 p-4 text-sm">
          <div className="mb-2 font-semibold text-olive-950">Aus dem Verbund zugerechnet</div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-olive-600">
            <dt>Eigene JAE</dt>
            <dd className="text-right tabular-nums text-olive-950">{formatNumber(result.own.employees, 1)}</dd>
            <dt>Partner (anteilig 25–50 %)</dt>
            <dd className="text-right tabular-nums text-olive-950">
              +{formatNumber(result.partnerContribution.employees, 1)}
            </dd>
            <dt>Verbunden (100 % &gt; 50 %)</dt>
            <dd className="text-right tabular-nums text-olive-950">
              +{formatNumber(result.linkedContribution.employees, 1)}
            </dd>
          </dl>
        </div>
      )}

      {/* Begründung */}
      {hasInput && result && result.reasons.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm text-olive-600">
          {result.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0 text-teal-600">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {hasInput && result?.nearThreshold && result.isKmu && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-500/20">
          Hinweis: Sie liegen nahe an der nächsten Schwelle. Ein Statuswechsel greift erst, wenn ein Schwellenwert in
          zwei aufeinanderfolgenden Geschäftsjahren über- bzw. unterschritten wird (Zwei-Jahres-Regel).
        </div>
      )}
    </div>
  )
}
