'use client'

import { useEffect } from 'react'

/**
 * Eingangs-Wahl direkt nach Link-Oeffnung: Wer stellt den Antrag?
 * - 'eskalator' (empfohlen): volle Journey mit allen Schritten
 * - 'selbst': Abkuerzung auf die Unterlagen-Seite (kein Portal-Formular)
 * Die Wahl steuert die Klickstrecke (aktiveSchritteFuer in schritte.ts).
 */
export function SchrittBeantragungsweg({
  daten,
  fehler,
  onChange,
}: {
  daten: Record<string, unknown>
  fehler: Record<string, string>
  onChange: (name: string, wert: unknown) => void
}) {
  // Smart Default: die empfohlene Concierge-Beantragung ist vorangewaehlt –
  // die eigene Auswahl gewinnt immer, nie ueberschreiben.
  useEffect(() => {
    if (daten.beantragungsweg) return
    const frame = requestAnimationFrame(() => onChange('beantragungsweg', 'eskalator'))
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmalig beim Mount; eigene Auswahl gewinnt immer
  }, [])

  const weg = (daten.beantragungsweg as string | undefined) ?? 'eskalator'

  const karte = (
    wert: 'eskalator' | 'selbst',
    titel: string,
    beschreibung: string,
    badges: { label: string; cls: string }[],
  ) => {
    const aktiv = weg === wert
    return (
      <button
        type="button"
        onClick={() => onChange('beantragungsweg', wert)}
        aria-pressed={aktiv}
        className={`relative flex flex-col gap-2 rounded-2xl border-2 p-5 pt-6 text-left transition-colors ${
          aktiv ? 'border-teal-600 bg-teal-50/60' : 'border-olive-200 bg-white hover:border-teal-400'
        }`}
      >
        {badges.length > 0 && (
          <span className="absolute -top-3 left-4 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span key={b.label} className={`rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ${b.cls}`}>
                {b.label}
              </span>
            ))}
          </span>
        )}
        <span className="text-base font-semibold text-mabe-900">{titel}</span>
        <span className="text-sm/6 text-olive-600">{beschreibung}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {karte(
          'eskalator',
          'Unser Fördermittel-Team beantragt für Sie',
          'Die WissensReich Academy (in Kooperation mit der Eskalator AG) stellt den Antrag in Ihrem Namen, beantwortet Rückfragen des BAFA und begleitet Sie bis zur Bewilligung – für Sie völlig kostenlos. Dafür erteilen Sie eine Vollmacht.',
          [
            { label: '⭐ Unsere Empfehlung', cls: 'bg-teal-600 text-white' },
            { label: 'KOSTENLOS', cls: 'bg-amber-400 text-mabe-900 ring-1 ring-amber-500' },
          ],
        )}
        {karte(
          'selbst',
          'Wir reichen selbst beim BAFA ein',
          'Sie bekommen sofort eine klare Checkliste und alle Unterlagen (Systemkonzept, Ihr Angebot) zum Download – Sie füllen dieses Portal nicht aus.',
          [],
        )}
      </div>
      {fehler.beantragungsweg && <p className="text-xs/5 font-medium text-red-700">{fehler.beantragungsweg}</p>}

      {/* Vergleich auf einen Blick: informierte statt „verkaufte" Entscheidung */}
      <div className="overflow-x-auto rounded-2xl border border-olive-200 bg-white">
        <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-olive-50 text-xs text-olive-500">
              <th className="px-4 py-2.5 font-semibold"></th>
              <th className="px-4 py-2.5 font-semibold text-teal-800">Fördermittel-Team ⭐</th>
              <th className="px-4 py-2.5 font-semibold text-olive-600">Selbst beantragen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive-100 text-sm">
            {(
              [
                ['Wer stellt den Antrag im BAFA-Portal?', 'Wir – komplett für Sie', 'Sie selbst (ELSTER-Zertifikat nötig)'],
                ['Wer beantwortet Rückfragen der Behörde?', 'Wir – bis zur Bewilligung', 'Sie selbst'],
                ['Kosten für Sie', '0 € (kostenlos)', '0 €, aber Ihr Zeitaufwand'],
                ['Ihr Aufwand', 'ca. 10 Minuten hier im Portal', 'Portal-Anmeldung + komplette Antragstellung'],
              ] as const
            ).map(([frage, team, selbst]) => (
              <tr key={frage}>
                <th className="px-4 py-2.5 font-medium text-mabe-900">{frage}</th>
                <td className="px-4 py-2.5 text-teal-800">
                  <span className="mr-1.5 text-teal-600" aria-hidden>✓</span>
                  {team}
                </td>
                <td className="px-4 py-2.5 text-olive-600">{selbst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
