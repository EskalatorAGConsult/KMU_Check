import { analysiereVerbund, type Holding } from '@/lib/kmu'

/**
 * Visualisierung der Beteiligungsstruktur (EU-KMU-Verbund).
 * Reine Darstellungskomponente auf Basis der geprueften Engine
 * (`analysiereVerbund` aus src/lib/kmu.ts): zeigt den Antragsteller als
 * Wurzel und darunter alle Beteiligungsunternehmen, eingezogen nach
 * Kettentiefe, mit der effektiven Verrechnungsquote.
 *
 * Wird im Journey-KMU-Schritt und im Landingpage-Tool verwendet, damit
 * Kund:innen ohne Fördermittel-Vorwissen sofort sehen, welche Firmen
 * wie in die Berechnung einfließen.
 */
export function VerbundBaum({ firmenname, holdings }: { firmenname: string; holdings: Holding[] }) {
  const wurzel = firmenname.trim() || 'Ihr Unternehmen'
  const zeilen = analysiereVerbund(wurzel, holdings).sort((a, b) => a.tiefe - b.tiefe || a.name.localeCompare(b.name))
  if (zeilen.length === 0) return null

  return (
    <section
      aria-label="Visualisierung der Beteiligungsstruktur"
      className="rounded-2xl border border-olive-200 bg-white p-4 sm:p-5"
    >
      <h4 className="text-sm font-semibold text-mabe-900">So wirkt Ihre Beteiligungsstruktur auf die Berechnung</h4>
      <p className="mt-1 text-xs/5 text-olive-500">
        Die Einrückung zeigt die Stufe in der Kette. Das Badge rechts zeigt, zu wie viel Prozent die Zahlen des
        Unternehmens in Ihre KMU-Berechnung einfließen (EU-Empfehlung 2003/361/EG).
      </p>

      <ol className="mt-4 flex flex-col gap-1.5" role="tree" aria-label="Beteiligungskette">
        <li role="treeitem" aria-level={1} className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mabe-900 text-white" aria-hidden>
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path
                fillRule="evenodd"
                d="M4 16.5v-13h-.25a.75.75 0 0 1 0-1.5h12.5a.75.75 0 0 1 0 1.5H16v13a.25.25 0 0 1-.25.25h-3.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 1-.75.75h-3.5a.25.25 0 0 1-.25-.25Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <span className="min-w-0 truncate text-sm font-semibold text-mabe-900">{wurzel}</span>
          <span className="shrink-0 rounded-full bg-olive-100 px-2 py-0.5 text-[11px] font-medium text-olive-600">
            Antragsteller
          </span>
        </li>
        {zeilen.map((z) => {
          const einzug = Math.min(z.tiefe, 6) * 14
          return (
            <li
              key={`${z.bezug}-${z.name}`}
              role="treeitem"
              aria-level={Math.min(z.tiefe + 1, 7)}
              className="flex min-w-0 items-start gap-2 border-l-2 border-olive-200 py-1 pl-2"
              style={{ marginLeft: einzug }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-mabe-900">{z.name}</p>
                <p className="text-[11px]/4 break-words text-olive-500">
                  {z.tiefe > 1 ? `Stufe ${z.tiefe} · ` : ''}Kante: {z.pct} % am Unternehmen „{z.bezug}“
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  z.art === 'verbunden'
                    ? 'bg-mabe-100 text-mabe-800'
                    : z.art === 'partner'
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-olive-100 text-olive-500'
                }`}
              >
                {z.art === 'verbunden'
                  ? 'zählt zu 100 %'
                  : z.art === 'partner'
                    ? `zählt zu ${Math.round(z.effektivPct)} %`
                    : 'nicht relevant'}
              </span>
            </li>
          )
        })}
      </ol>

      <p className="mt-3 border-t border-olive-100 pt-3 text-[11px]/4 text-olive-500">
        Über 50 % (auch über eine Kette von Mehrheiten): volle Verrechnung. 25–50 % direkt an Ihrem Unternehmen:
        anteilige Verrechnung. Darunter oder nur mittelbar: ohne Einfluss.
      </p>
    </section>
  )
}
