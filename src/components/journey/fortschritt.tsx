'use client'

import { SCHRITTE } from '@/lib/journey/schritte'
import { fortschrittInfo } from '@/lib/journey/fortschritt-info'
import { formatEUR } from '@/lib/kmu'

/**
 * Sticky-Fortschrittsbereich oben in der Journey (2026-Standard):
 * - Balken zaehlt ERLEDIGTE Schritte (Goal-Gradient) + Shimmer-Belohnung.
 * - Dynamische Restzeit („noch ~3 Min") als Vollendungs-Pull.
 * - Sticky-Zuschuss-Chip (Loss Aversion): der konkrete Zuschuss bleibt
 *   bei den „unlustigen" Schritten (Bank, Steuern) sichtbar.
 * - Mobil kompakt, ab lg klickbare Schritt-Kette (nur erreichte Schritte).
 */
export function Fortschritt({
  idx,
  onSprung,
  zuschuss,
}: {
  idx: number
  onSprung: (i: number) => void
  /** Konkreter Zuschuss in EUR (bereits ermittelt) oder „bis zu"-Maximum. */
  zuschuss?: { betrag: number; bisZu: boolean } | null
}) {
  const info = fortschrittInfo(idx, SCHRITTE.length)
  const aktuell = SCHRITTE[idx]

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-olive-100 bg-white/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-olive-600">
          <span className="font-semibold text-mabe-900">
            Schritt {idx + 1} von {SCHRITTE.length}
          </span>
          <span className="mx-1.5 text-olive-300" aria-hidden>
            ·
          </span>
          <span className="font-medium text-mabe-900">{aktuell.titel}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2.5">
          {zuschuss && zuschuss.betrag > 0 && (
            <span
              className="hidden items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white shadow-sm motion-safe:animate-check-pop sm:inline-flex"
              title="Ihr voraussichtlicher Zuschuss – ermittelt aus Ihren bisherigen Angaben"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden>
                <path d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06A.75.75 0 1 1 6.11 5.173L5.05 4.11a.75.75 0 0 1 0-1.06Zm9.9 0a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.061l1.061-1.06a.75.75 0 0 1 1.06 0ZM3 8a7 7 0 1 1 14 0v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8Z" />
              </svg>
              {zuschuss.bisZu ? 'bis zu ' : ''}
              {formatEUR(zuschuss.betrag)}
            </span>
          )}
          <p className="text-sm font-semibold text-teal-700 tabular-nums" aria-hidden>
            {info.prozent}&nbsp;%
          </p>
        </div>
      </div>

      {/* Balken: erledigte Schritte + Shimmer-Belohnung beim Wachsen */}
      <div
        className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-olive-100"
        role="progressbar"
        aria-valuenow={info.prozent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Fortschritt: ${info.prozent} Prozent – ${info.erledigt} von ${SCHRITTE.length} Schritten geschafft`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-500 transition-[width] duration-700 ease-out"
          style={{ width: `${info.prozent}%` }}
        />
        <div
          key={info.erledigt}
          aria-hidden
          className="animate-shimmer pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p className="text-xs text-olive-500">
          {info.erledigt > 0 ? (
            <>
              <span className="font-semibold text-teal-700">✓ {info.erledigt} geschafft</span>
              {!info.fertig && <span> · noch ca. {info.restMinuten} Min.</span>}
            </>
          ) : (
            <span>Los geht&apos;s – jeder Schritt wird automatisch gespeichert.</span>
          )}
        </p>
        {/* Mobile-Zuschuss-Chip (Desktop steht er oben rechts) */}
        {zuschuss && zuschuss.betrag > 0 && (
          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-800 sm:hidden">
            {zuschuss.bisZu ? 'bis zu ' : ''}
            {formatEUR(zuschuss.betrag)}
          </span>
        )}
      </div>

      {/* Klickbare Schritt-Kette (nur grosszuegige Viewports) */}
      <ol className="mt-2.5 hidden items-center gap-1 lg:flex" aria-label="Alle Schritte">
        {SCHRITTE.map((s, i) => {
          const erreicht = i <= idx
          const aktiv = i === idx
          return (
            <li key={s.id} className="flex min-w-0 items-center">
              <button
                type="button"
                disabled={!erreicht}
                onClick={() => onSprung(i)}
                aria-current={aktiv ? 'step' : undefined}
                title={s.titel}
                className={`flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  aktiv
                    ? 'bg-mabe-900 text-white'
                    : erreicht
                      ? 'text-teal-800 hover:bg-teal-50'
                      : 'cursor-default text-olive-400'
                }`}
              >
                <span
                  className={`flex size-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    aktiv
                      ? 'bg-white/20 text-white'
                      : erreicht
                        ? 'bg-teal-600 text-white'
                        : 'bg-olive-100 text-olive-400'
                  }`}
                >
                  {i < idx ? '✓' : i + 1}
                </span>
                {s.kurz ?? s.titel}
              </button>
              {i < SCHRITTE.length - 1 && <span className="mx-0.5 h-px w-3 shrink-0 bg-olive-200" aria-hidden />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
