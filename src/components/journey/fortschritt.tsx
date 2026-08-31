'use client'

import { SCHRITTE } from '@/lib/journey/schritte'

/**
 * Sticky-Fortschrittsbereich oben in der Journey.
 * - Mobil: kompakt (Schritt x von y + animierter Balken), kein Overflow.
 * - Desktop (ab lg): klickbare Schritt-Kette (nur bereits erreichte Schritte).
 */
export function Fortschritt({ idx, onSprung }: { idx: number; onSprung: (i: number) => void }) {
  const prozent = Math.round(((idx + 1) / SCHRITTE.length) * 100)
  const aktuell = SCHRITTE[idx]

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-olive-100 bg-white/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-olive-600">
          <span className="font-semibold text-mabe-900">
            Schritt {idx + 1} von {SCHRITTE.length}
          </span>
          <span className="mx-1.5 text-olive-300" aria-hidden>
            ·
          </span>
          <span className="font-medium text-mabe-900">{aktuell.titel}</span>
        </p>
        <p className="shrink-0 text-sm font-semibold text-teal-700 tabular-nums" aria-hidden>
          {prozent}&nbsp;%
        </p>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-olive-100"
        role="progressbar"
        aria-valuenow={prozent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Fortschritt: ${prozent} Prozent`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-500 transition-[width] duration-500 ease-out"
          style={{ width: `${prozent}%` }}
        />
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
