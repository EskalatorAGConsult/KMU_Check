'use client'

import { useEffect, useRef, useState } from 'react'

import { openregisterSuche, openregisterVerbund } from '@/lib/openregister/actions'
import type { RegisterTreffer, VerbundErgebnis } from '@/lib/openregister/mapping'

import { inputCls } from './ui'

/**
 * Handelsregister-Assistent im KMU-Schritt: Der Kunde sucht sein Unternehmen,
 * wir laden Gesellschafter + Beteiligungen + veröffentlichte Kennzahlen aus
 * dem Handelsregister/Bundesanzeiger (OpenRegister) und befüllen auf Wunsch
 * die Formularfelder vor. Alles bleibt editierbar – der Kunde prüft und
 * bestätigt. Best effort: Bei einem Fehler funktioniert die manuelle
 * Eingabe darunter einfach weiter.
 */

const fmtZahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

function euro(v?: number): string {
  return v === undefined ? '–' : `${fmtZahl.format(v)} €`
}

function zahl(v?: number): string {
  return v === undefined ? '–' : fmtZahl.format(v)
}

/** EU-Klassifizierung einer Beteiligung (2003/361/EG). */
function euKlasse(b: { klasse: 'partner' | 'verbunden'; anteil_pct: number }): { label: string; cls: string } {
  if (b.klasse === 'verbunden') {
    return {
      label: 'Verbundenes Unternehmen – zählt zu 100 %',
      cls: 'bg-amber-50 text-amber-800 ring-amber-600/30',
    }
  }
  return {
    label: `Partnerunternehmen – zählt anteilig (${fmtZahl.format(b.anteil_pct)} %)`,
    cls: 'bg-sky-50 text-sky-800 ring-sky-600/30',
  }
}

export function VerbundSuche({
  token,
  onUebernehmen,
}: {
  token: string
  onUebernehmen: (ergebnis: VerbundErgebnis) => void
}) {
  const [query, setQuery] = useState('')
  const [treffer, setTreffer] = useState<RegisterTreffer[] | null>(null)
  const [sucht, setSucht] = useState(false)
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<VerbundErgebnis | null>(null)
  const [ausCache, setAusCache] = useState(false)
  const [uebernommen, setUebernommen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const laufId = useRef(0)

  // Laufende Suche bei Unmount abbrechen
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  // Debounced Suche ab 3 Zeichen (im Event-Handler, nicht im Effect)
  const onQueryChange = (v: string) => {
    setQuery(v)
    setErgebnis(null)
    setUebernommen(false)
    setFehler(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = v.trim()
    if (q.length < 3) {
      setTreffer(null)
      setSucht(false)
      return
    }
    setSucht(true)
    debounceRef.current = setTimeout(async () => {
      const id = ++laufId.current
      const res = await openregisterSuche(token, q)
      if (id !== laufId.current) return // veraltete Antwort verwerfen
      setSucht(false)
      if (res.ok) setTreffer(res.treffer)
      else {
        setTreffer(null)
        setFehler(res.fehler)
      }
    }, 400)
  }

  const waehlen = async (t: RegisterTreffer) => {
    setLaedt(true)
    setFehler(null)
    setErgebnis(null)
    setUebernommen(false)
    setTreffer(null)
    setQuery(t.name)
    const res = await openregisterVerbund(token, t.companyId)
    setLaedt(false)
    if (res.ok) {
      setErgebnis(res.ergebnis)
      setAusCache(res.ausCache)
    } else {
      setFehler(res.fehler)
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-teal-600/25 bg-teal-50/40 p-5 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-mabe-900">
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 text-teal-700" aria-hidden>
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
              clipRule="evenodd"
            />
          </svg>
          Schnellstart: Handelsregister-Abfrage
        </h3>
        <p className="text-sm/6 text-olive-700">
          Wir suchen Ihr Unternehmen im <strong className="text-mabe-900">offiziellen Handelsregister</strong> und
          füllen Beschäftigte, Bilanzsumme und Ihre Beteiligungsverhältnisse automatisch vor – Sie prüfen die Werte
          anschließend nur noch. Kein Handelsregistereintrag (z. B. Einzelunternehmen)? Dann tragen Sie die Zahlen
          einfach darunter von Hand ein.
        </p>
      </div>

      {/* Suche */}
      <div className="relative">
        <label htmlFor="hr-suche" className="sr-only">
          Unternehmen im Handelsregister suchen
        </label>
        <input
          id="hr-suche"
          type="search"
          autoComplete="off"
          className={inputCls}
          placeholder="Firmenname eingeben, z. B. Muster GmbH …"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        {sucht && (
          <span className="absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium text-olive-500">
            Suche …
          </span>
        )}
      </div>

      {/* Trefferliste */}
      {treffer && !ergebnis && (
        <ul className="flex flex-col gap-2" aria-label="Suchergebnisse">
          {treffer.length === 0 && (
            <li className="rounded-xl border border-olive-200 bg-white px-4 py-3 text-sm text-olive-600">
              Kein Treffer im Handelsregister – bitte die Zahlen unten manuell eintragen.
            </li>
          )}
          {treffer.map((t) => (
            <li key={t.companyId}>
              <button
                type="button"
                onClick={() => waehlen(t)}
                className="flex w-full min-w-0 flex-col gap-0.5 rounded-xl border border-olive-200 bg-white px-4 py-3 text-left transition-colors hover:border-teal-600 hover:bg-teal-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold break-words text-mabe-900">{t.name}</span>
                  {!t.aktiv && (
                    <span className="rounded-full bg-olive-100 px-2 py-0.5 text-[11px] font-medium text-olive-600 ring-1 ring-olive-300">
                      erloschen/inaktiv
                    </span>
                  )}
                </span>
                <span className="text-xs/5 break-words text-olive-600">
                  {[t.adresse, t.registerLabel].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {laedt && (
        <p className="flex items-center gap-2 rounded-xl border border-teal-600/20 bg-white px-4 py-3 text-sm text-olive-700" role="status">
          <svg className="size-4 animate-spin text-teal-700" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
          </svg>
          Lade Gesellschafter, Beteiligungen und Kennzahlen aus dem Handelsregister – inklusive aller Folgestufen Ihrer Beteiligungskette …
        </p>
      )}

      {fehler && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200" role="alert">
          {fehler} Sie können die Angaben auch einfach manuell eintragen.
        </p>
      )}

      {/* Vorschau der gefundenen Daten */}
      {ergebnis && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-olive-200 bg-white p-4 sm:p-5">
            <p className="text-xs font-semibold tracking-wide text-olive-500 uppercase">Gefunden im Handelsregister</p>
            <p className="mt-1 text-base font-semibold break-words text-mabe-900">{ergebnis.unternehmen.name}</p>
            <p className="text-sm/6 break-words text-olive-600">
              {[ergebnis.unternehmen.strasse, `${ergebnis.unternehmen.plz ?? ''} ${ergebnis.unternehmen.ort ?? ''}`.trim()]
                .filter(Boolean)
                .join(', ')}
              {ergebnis.unternehmen.wzCode ? ` · WZ-Code ${ergebnis.unternehmen.wzCode}` : ''}
            </p>

            {/* Eigene Kennzahlen */}
            {ergebnis.jahre.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-0 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-olive-500">
                      <th className="pr-3 pb-1.5">Geschäftsjahr</th>
                      <th className="pr-3 pb-1.5">Beschäftigte</th>
                      <th className="pr-3 pb-1.5">Umsatz</th>
                      <th className="pb-1.5">Bilanzsumme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ergebnis.jahre.map((j) => (
                      <tr key={j.geschaeftsjahr} className="border-t border-olive-100 text-mabe-900">
                        <td className="pr-3 py-1.5 font-medium">{j.geschaeftsjahr}</td>
                        <td className="pr-3 py-1.5">{zahl(j.jae)}</td>
                        <td className="pr-3 py-1.5">{euro(j.umsatz)}</td>
                        <td className="py-1.5">{euro(j.bilanzsumme)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Verbund */}
          {ergebnis.beteiligungen.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-wide text-olive-500 uppercase">
                Ihr Unternehmensverbund laut Register ({ergebnis.beteiligungen.length})
              </p>
              {ergebnis.beteiligungen.map((b) => {
                const klasse = euKlasse(b)
                return (
                  <div key={`${b.registerId}-${b.stufe}`} className="rounded-xl border border-olive-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold break-words text-mabe-900">
                          {b.stufe > 1 && (
                            <span className="mr-1.5 rounded-full bg-mabe-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                              Stufe {b.stufe}
                            </span>
                          )}
                          {b.name}
                        </p>
                        <p className="text-xs/5 break-words text-olive-600">
                          {b.stufe > 1
                            ? `Über Ihre Beteiligungskette: ${b.pfad}`
                            : b.richtung === 'aufwaerts'
                              ? `hält ${fmtZahl.format(b.anteil_direkt_pct)} % an Ihrem Unternehmen`
                              : `Ihr Unternehmen hält ${fmtZahl.format(b.anteil_direkt_pct)} % daran`}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${klasse.cls}`}>
                        {klasse.label}
                      </span>
                    </div>
                    {(b.jae !== undefined || b.umsatz !== undefined || b.bilanzsumme !== undefined) && (
                      <p className="mt-2 text-xs/5 text-olive-600">
                        Veröffentlichte Kennzahlen: {zahl(b.jae)} Beschäftigte · Umsatz {euro(b.umsatz)} · Bilanzsumme{' '}
                        {euro(b.bilanzsumme)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-olive-200 bg-white px-4 py-3 text-sm text-olive-700">
              Keine Beteiligungsverhältnisse ab 25 % gefunden – Ihr Unternehmen wird als eigenständig bewertet.
            </p>
          )}

          {/* Hinweise */}
          {ergebnis.ignoriert.length > 0 && (
            <p className="text-xs/5 text-olive-500">
              Nicht relevant (unter 25 %): {ergebnis.ignoriert.map((i) => `${i.name} (${fmtZahl.format(i.anteil_pct)} %)`).join(', ')}
            </p>
          )}
          {ergebnis.natuerlichePersonen > 0 && (
            <p className="text-xs/5 text-olive-500">
              {ergebnis.natuerlichePersonen === 1
                ? 'Ein Gesellschafter ist eine natürliche Person'
                : `${ergebnis.natuerlichePersonen} Gesellschafter sind natürliche Personen`}{' '}
              – Privatpersonen zählen nicht zum Unternehmensverbund.
            </p>
          )}
          {ergebnis.kennzahlenUnvollstaendig && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs/5 font-medium text-amber-800 ring-1 ring-amber-600/20">
              Für mindestens ein Verbundunternehmen sind keine Kennzahlen veröffentlicht (kleine Gesellschaften
              müssen wenig offenlegen). Bitte ergänzen Sie Beschäftigte und Umsatz/Bilanzsumme nach der Übernahme
              von Hand – Ihr Steuerbüro oder die Geschäftsführung der Schwesterfirma hilft weiter.
            </p>
          )}
          {ergebnis.ketteAbgeschnitten && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs/5 font-medium text-amber-800 ring-1 ring-amber-600/20">
              Ihre Beteiligungskette ist sehr groß und wurde aus Sicherheitsgründen nicht vollständig durchsucht.
              Bitte prüfen Sie, ob weitere Stufen existieren, und ergänzen Sie diese von Hand.
            </p>
          )}

          {/* Übernehmen */}
          {uebernommen ? (
            <p className="flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 ring-1 ring-teal-600/20" role="status">
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
              Übernommen – bitte prüfen Sie die vorbefüllten Werte unten und passen Sie sie bei Abweichungen an.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                onUebernehmen(ergebnis)
                setUebernommen(true)
              }}
              className="min-h-12 self-start rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 focus-visible:ring-offset-2"
            >
              Werte in das Formular übernehmen
            </button>
          )}

          <p className="text-xs/5 text-olive-400">
            Datenquelle: Handelsregister & Bundesanzeiger (via OpenRegister){ausCache ? ' · zwischengespeicherter Stand' : ''}.
            Maßgeblich ist immer Ihr Jahresabschluss – Abweichungen bitte korrigieren.
          </p>
        </div>
      )}
    </section>
  )
}
