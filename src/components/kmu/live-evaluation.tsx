'use client'

import { clsx } from 'clsx/lite'
import { useState } from 'react'
import type { Category, KmuResult } from '@/lib/kmu'
import { formatEUR, formatNumber } from '@/lib/kmu'

const CATEGORY_THRESHOLDS: Record<Exclude<Category, 'gross'>, { emp: number; turnover: number; balance: number }> = {
  kleinst: { emp: 10, turnover: 2_000_000, balance: 2_000_000 },
  klein: { emp: 50, turnover: 10_000_000, balance: 10_000_000 },
  mittel: { emp: 250, turnover: 50_000_000, balance: 43_000_000 },
}

const CATEGORY_META: Record<
  Category,
  { tone: string; pill: string; isKmu: boolean; plain: string }
> = {
  kleinst: {
    tone: 'text-teal-700',
    pill: 'bg-teal-50 text-teal-800 ring-teal-600/20',
    isKmu: true,
    plain: 'Ihr Unternehmen ist ein KMU (Kleinstunternehmen) – es gilt die höchste Förderquote.',
  },
  klein: {
    tone: 'text-teal-700',
    pill: 'bg-teal-50 text-teal-800 ring-teal-600/20',
    isKmu: true,
    plain: 'Ihr Unternehmen ist ein KMU (kleines Unternehmen) – es gilt die höchste Förderquote.',
  },
  mittel: {
    tone: 'text-mabe-700',
    pill: 'bg-mabe-50 text-mabe-800 ring-mabe-600/20',
    isKmu: true,
    plain: 'Ihr Unternehmen ist ein KMU (mittleres Unternehmen).',
  },
  gross: {
    tone: 'text-olive-700',
    pill: 'bg-olive-100 text-olive-700 ring-olive-300',
    isKmu: false,
    plain: 'Ihr Unternehmen überschreitet die KMU-Schwellen und gilt als Großunternehmen.',
  },
}

function MiniBar({ value, threshold }: { value: number; threshold: number }) {
  const pct = Math.min(100, threshold > 0 ? (value / threshold) * 100 : 0)
  const over = value > threshold
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-olive-100">
      <div
        className={clsx('h-full rounded-full transition-smooth', over ? 'bg-olive-400' : 'bg-teal-500')}
        style={{ width: `${Math.max(3, pct)}%` }}
      />
    </div>
  )
}

const FUNDING_STOPS = [25, 35, 45]

function FundingScale({ activeRate }: { activeRate: number }) {
  return (
    <div className="flex gap-1.5">
      {FUNDING_STOPS.map((rate) => {
        const active = rate === activeRate
        return (
          <div
            key={rate}
            className={clsx(
              'flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-smooth',
              active ? 'bg-mabe-900 text-white' : 'bg-olive-100 text-olive-400',
            )}
          >
            {rate}%
          </div>
        )
      })}
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
  const [offer, setOffer] = useState('100000')
  const offerNum = parseFloat(offer.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) || 0

  const ready = hasInput && !!result
  const meta = result ? CATEGORY_META[result.category] : CATEGORY_META.klein
  const t =
    result && result.category !== 'gross' ? CATEGORY_THRESHOLDS[result.category] : CATEGORY_THRESHOLDS.mittel

  const hasVerbund =
    !!result &&
    (result.partnerContribution.employees > 0 ||
      result.linkedContribution.employees > 0 ||
      result.partnerContribution.turnover > 0 ||
      result.linkedContribution.turnover > 0)

  const subsidy = ready ? (offerNum * (result!.fundingRatePct || 0)) / 100 : 0
  const ownShare = offerNum - subsidy

  return (
    <div className={clsx('flex flex-col gap-8 rounded-3xl bg-white p-7 ring-1 ring-olive-200/70 sm:p-9', className)}>
      {/* Kopf */}
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-teal-500" />
        </span>
        <span className="text-xs font-semibold tracking-wide text-olive-400 uppercase">Ihr Ergebnis · live</span>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-3xl font-semibold tracking-tight text-mabe-900">
            {ready ? result!.categoryLabel.replace(' (kein KMU)', '') : 'Bereit'}
          </h3>
          {ready && (
            <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1', meta.pill)}>
              {meta.isKmu ? 'KMU' : 'Kein KMU'}
            </span>
          )}
        </div>
        <p className="text-sm/6 text-olive-600">
          {ready ? meta.plain : 'Beantworten Sie die Fragen – Ihre Auswertung erscheint hier sofort und live.'}
        </p>
      </div>

      {/* Förderquote */}
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <span className="text-xs font-semibold tracking-wide text-olive-400 uppercase">Förderquote</span>
          <span className="text-xs text-olive-400">BAFA Modul 3</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-6xl font-semibold tracking-tight text-mabe-900 tabular-nums">
            {ready ? result!.fundingRatePct : '—'}
          </span>
          <span className="text-3xl font-semibold text-olive-300">%</span>
        </div>
        <FundingScale activeRate={ready ? result!.fundingRatePct : -1} />
        <p className="text-sm/6 text-olive-600">
          Das ist der Anteil der <strong className="font-semibold text-olive-800">förderfähigen Netto-Investition</strong>,
          den der Staat als Zuschuss übernimmt.
        </p>
      </div>

      {/* Was bedeutet das für ein MABE-Angebot */}
      <div className="flex flex-col gap-4 rounded-2xl bg-mabe-900 p-5 text-white">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-wide text-teal-300 uppercase">
            Ihr Vorteil bei MABE
          </span>
          <p className="text-sm/6 text-olive-200">
            Stellen Sie den Förderantrag <strong className="font-semibold text-white">vor der Beauftragung</strong>, wird
            die Quote direkt auf das Netto-Angebot von MABE angerechnet.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-olive-300">Netto-Angebot / Investition</span>
          <div className="flex items-stretch overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/15 focus-within:ring-2 focus-within:ring-teal-400">
            <input
              type="text"
              inputMode="decimal"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              aria-label="Netto-Angebot in Euro"
              className="w-full bg-transparent px-3.5 py-2.5 text-base text-white outline-none placeholder:text-olive-400"
            />
            <span className="flex items-center bg-white/5 px-3 text-sm font-medium text-olive-300">€</span>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-teal-500/15 p-3">
            <div className="text-xs text-teal-200">Möglicher Zuschuss</div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums text-teal-300">
              {ready ? formatEUR(subsidy) : '—'}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-xs text-olive-300">Ihr Eigenanteil</div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums text-white">
              {ready ? formatEUR(ownShare) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Kennzahlen vs. Schwellenwerte */}
      <div className="flex flex-col gap-4">
        <span className="text-xs font-semibold tracking-wide text-olive-400 uppercase">
          {hasVerbund ? 'Konsolidierte Verbundwerte' : 'Ihre Werte'} · vs. Grenze
        </span>
        {[
          {
            label: 'Beschäftigte (JAE)',
            value: result?.consolidated.employees ?? 0,
            threshold: t.emp,
            fmt: (n: number) => formatNumber(n, 1),
          },
          {
            label: 'Jahresumsatz',
            value: result?.consolidated.turnover ?? 0,
            threshold: t.turnover,
            fmt: formatEUR,
          },
          {
            label: 'Bilanzsumme',
            value: result?.consolidated.balanceSheet ?? 0,
            threshold: t.balance,
            fmt: formatEUR,
          },
        ].map((row) => (
          <div key={row.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-olive-600">{row.label}</span>
              <span className="tabular-nums text-olive-400">
                <span className="font-semibold text-olive-900">{row.fmt(row.value)}</span> / {row.fmt(row.threshold)}
              </span>
            </div>
            <MiniBar value={row.value} threshold={row.threshold} />
          </div>
        ))}
      </div>

      {/* Verbund-Herkunft */}
      {hasVerbund && result && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-2xl bg-olive-50 p-4 text-sm">
          <dt className="text-olive-500">Eigene JAE</dt>
          <dd className="text-right tabular-nums text-olive-900">{formatNumber(result.own.employees, 1)}</dd>
          <dt className="text-olive-500">Partner (anteilig)</dt>
          <dd className="text-right tabular-nums text-olive-900">+{formatNumber(result.partnerContribution.employees, 1)}</dd>
          <dt className="text-olive-500">Verbunden (100 %)</dt>
          <dd className="text-right tabular-nums text-olive-900">+{formatNumber(result.linkedContribution.employees, 1)}</dd>
        </dl>
      )}

      {/* Disclaimer */}
      <p className="border-t border-olive-100 pt-4 text-xs/5 text-olive-400">
        Unverbindliche Orientierung auf Basis Ihrer Angaben (EU 2003/361/EG). Keine Rechts- oder Steuerberatung – im
        Zweifel durch Steuerberater bestätigen lassen. Maßgeblich ist die Prüfung der Bewilligungsbehörde.
      </p>
    </div>
  )
}
