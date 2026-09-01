'use client'

import { formatEUR, formatNumber, type Category, type KmuResult } from '@/lib/kmu'

/**
 * KMU-Ampel: zeigt Laien sofort verstaendlich die Foerderstufe.
 * Das Licht ist bewusst IMMER gruen – jede Einstufung ist foerderfaehig
 * (45 / 35 / 25 %), es gibt keine „schlechte" Ampel. Der Text differenziert
 * trotzdem ehrlich nach Kategorie und nennt die konkrete Quote und Summe.
 */

interface Stufe {
  kategorien: Category[]
  titel: string
  text: string
}

const STUFEN: Stufe[] = [
  {
    kategorien: ['kleinst', 'klein'],
    titel: 'Sie erhalten die Höchstförderung!',
    text: 'Ihr Unternehmen gilt als kleines Unternehmen. Damit steht Ihnen die höchste Förderquote von 45 % zu.',
  },
  {
    kategorien: ['mittel'],
    titel: 'Sie werden mit 35 % gefördert!',
    text: 'Ihr Unternehmen gilt als mittleres Unternehmen. Die Förderquote beträgt 35 % – ein deutlicher Zuschuss zu Ihrer Investition.',
  },
  {
    kategorien: ['gross'],
    titel: 'Sie werden mit 25 % gefördert!',
    text: 'Ihr Unternehmen überschreitet die KMU-Grenzen – die Förderung ist trotzdem mit 25 % möglich, nur die KMU-Bonus-Quoten entfallen.',
  },
]

function stufeFuer(category: Category): Stufe {
  return STUFEN.find((s) => s.kategorien.includes(category)) ?? STUFEN[STUFEN.length - 1]
}

// Ampel-Lichter: nur Gruen leuchtet (alle Stufen sind foerderfaehig).
const LICHT_FARBEN = {
  rot: { aktiv: '', inaktiv: 'bg-red-950/60' },
  gelb: { aktiv: '', inaktiv: 'bg-amber-950/60' },
  gruen: { aktiv: 'bg-emerald-400 shadow-[0_0_20px_4px_rgba(52,211,153,0.55)]', inaktiv: '' },
} as const

export function KmuAmpel({ ergebnis, investSumme }: { ergebnis: KmuResult; investSumme: number | null }) {
  const stufe = stufeFuer(ergebnis.category)
  const zuschuss = investSumme != null && investSumme > 0 ? (investSumme * ergebnis.fundingRatePct) / 100 : null

  return (
    <section
      aria-live="polite"
      aria-label="Ergebnis der KMU-Prüfung"
      className="overflow-hidden rounded-2xl bg-mabe-900 text-white shadow-lg"
    >
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-7 sm:p-7">
        {/* Ampel – leuchtet immer gruen: jede Stufe ist foerderfaehig */}
        <div
          className="flex shrink-0 items-center justify-center gap-3 self-start rounded-2xl bg-black/30 px-4 py-3 sm:flex-col sm:gap-3.5 sm:px-4 sm:py-5"
          aria-hidden
        >
          {(['rot', 'gelb', 'gruen'] as const).map((farbe) => {
            const aktiv = farbe === 'gruen'
            return (
              <span
                key={farbe}
                className={`size-7 rounded-full transition-all duration-700 sm:size-9 ${
                  aktiv ? `${LICHT_FARBEN[farbe].aktiv} motion-safe:animate-pulse` : LICHT_FARBEN[farbe].inaktiv
                }`}
              />
            )
          })}
        </div>

        {/* Ergebnis – poppt dezent bei jedem Kategorie-Wechsel (Aufmerksamkeits-Reward) */}
        <div key={ergebnis.category} className="min-w-0 flex-1 motion-safe:animate-check-pop">
          <p className="text-xs font-semibold tracking-wide text-olive-300 uppercase">
            Live-Auswertung · {ergebnis.categoryLabel}
          </p>
          <h3 className="mt-1.5 text-xl leading-snug font-semibold text-balance sm:text-2xl">{stufe.titel}</h3>
          <p className="mt-2 max-w-prose text-sm/6 text-olive-200">{stufe.text}</p>

          {zuschuss != null && (
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className="font-display font-semibold text-teal-300 tabular-nums"
                style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', lineHeight: 1.1 }}
              >
                bis zu {formatEUR(zuschuss)}
              </span>
              <span className="text-sm text-olive-300">
                Zuschuss ({ergebnis.fundingRatePct} % von {formatEUR(investSumme!)})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Kennzahlen-Fusszeile */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border-t border-white/10 bg-black/20 px-5 py-3 text-xs/5 text-olive-300 sm:px-7">
        <span>
          Verbund-gerechnet: <strong className="text-white">{formatNumber(ergebnis.consolidated.employees, 1)}</strong>{' '}
          Beschäftigte (JAE)
        </span>
        <span>
          Umsatz <strong className="text-white">{formatEUR(ergebnis.consolidated.turnover)}</strong>
        </span>
        <span>
          Bilanzsumme <strong className="text-white">{formatEUR(ergebnis.consolidated.balanceSheet)}</strong>
        </span>
        <span className="w-full text-olive-400 sm:ml-auto sm:w-auto">
          Unverbindliche Orientierung (EU 2003/361/EG) – verbindlich prüft die Bewilligungsbehörde.
        </span>
      </div>
    </section>
  )
}
