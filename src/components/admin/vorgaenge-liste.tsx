'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'

import type { AngebotListeItem } from '@/lib/db/repositories/angebote'
import type { AngebotStatus } from '@/lib/db/types'
import { archiviereVorgangSchnell } from '@/lib/admin/kunden-actions'

/**
 * „Alle Vorgänge" mit Blätterfunktion, Status-Filter, Volltextsuche und
** schnellem Archivieren (ein Klick direkt in der Liste, ohne Fallakte).
** Archivierte Vorgänge sind standardmässig ausgeblendet.
*/

const STATUS_LABEL: Record<AngebotStatus, string> = {
  angelegt: 'Angelegt',
  eingeladen: 'Eingeladen',
  in_bearbeitung: 'In Bearbeitung',
  eingereicht: 'Eingereicht',
  abgeschlossen: 'Antrag gestellt',
  bewilligt: 'Bewilligt',
  vnw_eingereicht: 'VNW eingereicht',
  archiviert: 'Archiviert',
  widerrufen: 'Widerrufen',
}

const STATUS_CLS: Record<AngebotStatus, string> = {
  angelegt: 'bg-olive-100 text-olive-700',
  eingeladen: 'bg-mabe-100 text-mabe-800',
  in_bearbeitung: 'bg-amber-100 text-amber-800',
  eingereicht: 'bg-teal-100 text-teal-800',
  abgeschlossen: 'bg-teal-600 text-white',
  bewilligt: 'bg-teal-600 text-white',
  vnw_eingereicht: 'bg-teal-700 text-white',
  archiviert: 'bg-olive-200 text-olive-600',
  widerrufen: 'bg-red-100 text-red-700',
}

/** Statusse, aus denen direkt archiviert werden kann. */
const ARCHIVIERBAR = new Set<AngebotStatus>(['abgeschlossen', 'bewilligt', 'vnw_eingereicht'])

const SEITEN_GROESSEN = [10, 20, 50] as const
const STATUS_REIHENFOLGE = Object.keys(STATUS_LABEL) as AngebotStatus[]

const inputCls =
  'w-full rounded-xl border border-olive-300 bg-white px-3 py-2.5 text-sm text-mabe-900 placeholder:text-olive-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30'

export function VorgaengeListe({ angebote }: { angebote: AngebotListeItem[] }) {
  const [suche, setSuche] = useState('')
  const [status, setStatus] = useState<AngebotStatus | 'alle'>('alle')
  const [proSeite, setProSeite] = useState<(typeof SEITEN_GROESSEN)[number]>(10)
  const [seite, setSeite] = useState(1)
  const [archivZeigen, setArchivZeigen] = useState(false)
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return angebote.filter((a) => {
      if (!archivZeigen && a.status === 'archiviert') return false
      if (status !== 'alle' && a.status !== status) return false
      if (!q) return true
      return (
        a.kunde_firma.toLowerCase().includes(q) ||
        a.kunde_email.toLowerCase().includes(q) ||
        a.angebot_nr.toLowerCase().includes(q)
      )
    })
  }, [angebote, suche, status, archivZeigen])

  const seiten = Math.max(1, Math.ceil(gefiltert.length / proSeite))
  const aktuelleSeite = Math.min(seite, seiten)
  const von = (aktuelleSeite - 1) * proSeite
  const sichtbar = gefiltert.slice(von, von + proSeite)
  const archiviertCount = angebote.filter((a) => a.status === 'archiviert').length

  function zuruecksetzen() {
    setSeite(1)
  }

  function toggleArchiv(a: AngebotListeItem) {
    setMeldung(null)
    startTransition(async () => {
      const res = await archiviereVorgangSchnell(a.id, a.status !== 'archiviert')
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis ?? 'Erledigt.' } : { art: 'fehler', text: res.fehler })
    })
  }

  /** Kompakte Seitenauswahl: aktuell ± 1, Ränder, bei Bedarf mit „…". */
  function seitenZahlen(): (number | '…')[] {
    const set = new Set<number>([1, seiten, aktuelleSeite - 1, aktuelleSeite, aktuelleSeite + 1])
    const liste = [...set].filter((n) => n >= 1 && n <= seiten).sort((a, b) => a - b)
    const ausgabe: (number | '…')[] = []
    liste.forEach((n, i) => {
      if (i > 0 && n - (liste[i - 1] as number) > 1) ausgabe.push('…')
      ausgabe.push(n)
    })
    return ausgabe
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filterleiste */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <span className="sr-only">Vorgänge suchen</span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-olive-400"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
              clipRule="evenodd"
            />
          </svg>
          <input
            className={`${inputCls} pl-9`}
            placeholder="Suchen: Firma, E-Mail oder Angebots-Nr. …"
            value={suche}
            onChange={(e) => {
              setSuche(e.target.value)
              zuruecksetzen()
            }}
          />
        </label>
        <label className="block">
          <span className="sr-only">Nach Status filtern</span>
          <select
            className={inputCls}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as AngebotStatus | 'alle')
              zuruecksetzen()
            }}
          >
            <option value="alle">Alle Status</option>
            {STATUS_REIHENFOLGE.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Einträge pro Seite</span>
          <select
            className={inputCls}
            value={proSeite}
            onChange={(e) => {
              setProSeite(Number(e.target.value) as (typeof SEITEN_GROESSEN)[number])
              zuruecksetzen()
            }}
          >
            {SEITEN_GROESSEN.map((n) => (
              <option key={n} value={n}>
                {n} pro Seite
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Archiv-Toggle + Zaehler */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-olive-600">
          <input
            type="checkbox"
            checked={archivZeigen}
            onChange={(e) => {
              setArchivZeigen(e.target.checked)
              zuruecksetzen()
            }}
            className="size-5 rounded border-olive-300 text-teal-600 focus:ring-teal-600"
          />
          Archivierte anzeigen
          {archiviertCount > 0 && (
            <span className="rounded-full bg-olive-100 px-2 py-0.5 text-xs font-semibold text-olive-600">
              {archiviertCount}
            </span>
          )}
        </label>
        <p className="text-xs text-olive-500" role="status">
          {gefiltert.length === angebote.length
            ? `${angebote.length} ${angebote.length === 1 ? 'Vorgang' : 'Vorgänge'}`
            : `${gefiltert.length} von ${angebote.length} Vorgängen`}
        </p>
      </div>

      {meldung && (
        <p
          role={meldung.art === 'ok' ? 'status' : 'alert'}
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            meldung.art === 'ok' ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {meldung.text}
        </p>
      )}

      {sichtbar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-olive-300 p-10 text-center">
          <p className="text-olive-600">
            Keine Vorgänge für diese Filterung.
            {!archivZeigen && archiviertCount > 0 && ' Archivierte sind ausgeblendet.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSuche('')
              setStatus('alle')
              setArchivZeigen(false)
              zuruecksetzen()
            }}
            className="mt-3 text-sm font-semibold text-teal-700 hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700"
          >
            Filter zurücksetzen
          </button>
        </div>
      ) : (
        <>
          {/* Mobile: Karten */}
          <ul className="flex flex-col gap-3 sm:hidden">
            {sichtbar.map((a) => (
              <li key={a.id} className="flex flex-col gap-2.5 rounded-2xl border border-olive-200 bg-white p-4">
                <Link
                  href={`/admin/kunden/${a.id}`}
                  className="flex flex-col gap-2 transition-colors focus-visible:bg-teal-50"
                  aria-label={`Vorgang ${a.angebot_nr} von ${a.kunde_firma} öffnen`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                    <span className="text-xs text-olive-500 tabular-nums">
                      {new Date(a.created_at).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-mabe-900">{a.kunde_firma}</p>
                    <p className="truncate text-xs text-olive-500">{a.kunde_email}</p>
                  </div>
                  <p className="text-sm text-olive-700">
                    {a.angebot_nr}
                    <span className="text-olive-400"> · {new Date(a.angebot_datum).toLocaleDateString('de-DE')}</span>
                  </p>
                </Link>
                {(ARCHIVIERBAR.has(a.status) || a.status === 'archiviert') && (
                  <button
                    type="button"
                    onClick={() => toggleArchiv(a)}
                    disabled={pending}
                    className={`self-start rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90 disabled:opacity-50 ${
                      a.status === 'archiviert'
                        ? 'border border-teal-600 text-teal-700 hover:bg-teal-50'
                        : 'border border-olive-300 text-olive-600 hover:bg-olive-100'
                    }`}
                  >
                    {a.status === 'archiviert' ? 'Reaktivieren' : 'Archivieren'}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* Ab sm: Tabelle */}
          <div className="hidden overflow-x-auto rounded-2xl ring-1 ring-olive-200 sm:block">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-olive-50 text-olive-500">
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Kunde</th>
                  <th className="px-5 py-3.5 font-semibold">Angebot</th>
                  <th className="px-5 py-3.5 font-semibold">Angelegt</th>
                  <th className="px-5 py-3.5 text-right font-semibold">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-olive-100 bg-white">
                {sichtbar.map((a) => {
                  const href = `/admin/kunden/${a.id}`
                  const linkCls =
                    'block px-5 py-3.5 outline-none focus-visible:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-inset'
                  const istArchiviert = a.status === 'archiviert'
                  const kannArchivieren = ARCHIVIERBAR.has(a.status) || istArchiviert
                  return (
                    <tr key={a.id} className={`transition-colors hover:bg-olive-50 ${istArchiviert ? 'opacity-60' : ''}`}>
                      <td className="p-0">
                        <Link href={href} className={linkCls} aria-label={`Vorgang ${a.angebot_nr} öffnen`}>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[a.status]}`}>
                            {STATUS_LABEL[a.status]}
                          </span>
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className={linkCls} tabIndex={-1} aria-hidden>
                          <div className="font-medium text-mabe-900">{a.kunde_firma}</div>
                          <div className="text-xs text-olive-500">{a.kunde_email}</div>
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className={`${linkCls} text-olive-700`} tabIndex={-1} aria-hidden>
                          {a.angebot_nr}
                          <span className="text-olive-400">
                            {' '}
                            · {new Date(a.angebot_datum).toLocaleDateString('de-DE')}
                          </span>
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link href={href} className={`${linkCls} text-olive-500`} tabIndex={-1} aria-hidden>
                          {new Date(a.created_at).toLocaleDateString('de-DE')}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {kannArchivieren && (
                          <button
                            type="button"
                            onClick={() => toggleArchiv(a)}
                            disabled={pending}
                            title={istArchiviert ? 'Vorgang reaktivieren' : 'Vorgang archivieren (aus Liste entfernen)'}
                            aria-label={istArchiviert ? `${a.angebot_nr} reaktivieren` : `${a.angebot_nr} archivieren`}
                            className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90 disabled:opacity-50 ${
                              istArchiviert
                                ? 'text-teal-700 hover:bg-teal-50'
                                : 'text-olive-500 hover:bg-olive-100 hover:text-olive-700'
                            }`}
                          >
                            {istArchiviert ? (
                              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
                                <path
                                  fillRule="evenodd"
                                  d="M9.53 2.47a.75.75 0 0 0-1.06 0L4.72 6.22a.75.75 0 0 0 1.06 1.06l2.47-2.47v6.69a.75.75 0 0 0 1.5 0V4.81l2.47 2.47a.75.75 0 1 0 1.06-1.06L9.53 2.47ZM3.75 12.5a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 5 17.75h10a2.75 2.75 0 0 0 2.75-2.75v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H5c-.69 0-1.25-.56-1.25-1.25v-2.5Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
                                <path d="M2 4.25A2.25 2.25 0 0 1 4.25 2h11.5A2.25 2.25 0 0 1 18 4.25v1.5A2.25 2.25 0 0 1 15.75 8H4.25A2.25 2.25 0 0 1 2 5.75v-1.5ZM3.5 9.75a.75.75 0 0 0-1.5 0v6A2.75 2.75 0 0 0 4.75 18.5h10.5a2.75 2.75 0 0 0 2.75-2.75v-6a.75.75 0 0 0-1.5 0v6c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-6Z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {seiten > 1 && (
            <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Vorgänge blättern">
              <p className="text-xs text-olive-500 tabular-nums">
                {von + 1} bis {Math.min(von + proSeite, gefiltert.length)} von {gefiltert.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSeite(Math.max(1, aktuelleSeite - 1))}
                  disabled={aktuelleSeite <= 1}
                  className="min-h-10 rounded-lg border border-olive-300 px-3 text-sm font-semibold text-mabe-900 hover:bg-olive-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90 disabled:opacity-40"
                >
                  Zurück
                </button>
                {seitenZahlen().map((n, i) =>
                  n === '…' ? (
                    <span key={`dots-${i}`} className="px-1 text-olive-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSeite(n)}
                      aria-current={n === aktuelleSeite ? 'page' : undefined}
                      className={`min-h-10 min-w-10 rounded-lg px-2 text-sm font-semibold tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90 ${
                        n === aktuelleSeite
                          ? 'bg-mabe-900 text-white'
                          : 'border border-olive-300 text-mabe-900 hover:bg-olive-100'
                      }`}
                    >
                      {n}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setSeite(Math.min(seiten, aktuelleSeite + 1))}
                  disabled={aktuelleSeite >= seiten}
                  className="min-h-10 rounded-lg border border-olive-300 px-3 text-sm font-semibold text-mabe-900 hover:bg-olive-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90 disabled:opacity-40"
                >
                  Weiter
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
