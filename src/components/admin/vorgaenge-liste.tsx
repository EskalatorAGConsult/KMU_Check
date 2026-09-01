'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { AngebotListeItem } from '@/lib/db/repositories/angebote'
import type { AngebotStatus } from '@/lib/db/types'

/**
 * „Alle Vorgänge" mit Blätterfunktion, Status-Filter und Volltextsuche.
 * Rein clientseitig: Die (auf 1000 begrenzte) Liste wird einmal vom Server
 * geliefert, Filtern und Blättern brauchen keinen Roundtrip.
 */

const STATUS_LABEL: Record<AngebotStatus, string> = {
  angelegt: 'Angelegt',
  eingeladen: 'Eingeladen',
  in_bearbeitung: 'In Bearbeitung',
  eingereicht: 'Eingereicht',
  abgeschlossen: 'Abgeschlossen',
  widerrufen: 'Widerrufen',
}

const STATUS_CLS: Record<AngebotStatus, string> = {
  angelegt: 'bg-olive-100 text-olive-700',
  eingeladen: 'bg-mabe-100 text-mabe-800',
  in_bearbeitung: 'bg-amber-100 text-amber-800',
  eingereicht: 'bg-teal-100 text-teal-800',
  abgeschlossen: 'bg-teal-600 text-white',
  widerrufen: 'bg-red-100 text-red-700',
}

const SEITEN_GROESSEN = [10, 20, 50] as const
const STATUS_REIHENFOLGE = Object.keys(STATUS_LABEL) as AngebotStatus[]

const inputCls =
  'w-full rounded-xl border border-olive-300 bg-white px-3 py-2.5 text-sm text-mabe-900 placeholder:text-olive-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30'

export function VorgaengeListe({ angebote }: { angebote: AngebotListeItem[] }) {
  const [suche, setSuche] = useState('')
  const [status, setStatus] = useState<AngebotStatus | 'alle'>('alle')
  const [proSeite, setProSeite] = useState<(typeof SEITEN_GROESSEN)[number]>(10)
  const [seite, setSeite] = useState(1)

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return angebote.filter((a) => {
      if (status !== 'alle' && a.status !== status) return false
      if (!q) return true
      return (
        a.kunde_firma.toLowerCase().includes(q) ||
        a.kunde_email.toLowerCase().includes(q) ||
        a.angebot_nr.toLowerCase().includes(q)
      )
    })
  }, [angebote, suche, status])

  const seiten = Math.max(1, Math.ceil(gefiltert.length / proSeite))
  const aktuelleSeite = Math.min(seite, seiten)
  const von = (aktuelleSeite - 1) * proSeite
  const sichtbar = gefiltert.slice(von, von + proSeite)

  function zuruecksetzen() {
    setSeite(1)
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
      {/* Filterleiste: Suche + Status + Einträge pro Seite */}
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

      <p className="text-xs text-olive-500" role="status">
        {gefiltert.length === angebote.length
          ? `${angebote.length} ${angebote.length === 1 ? 'Vorgang' : 'Vorgänge'}`
          : `${gefiltert.length} von ${angebote.length} Vorgängen (gefiltert)`}
      </p>

      {sichtbar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-olive-300 p-10 text-center">
          <p className="text-olive-600">Keine Vorgänge für diese Filterung.</p>
          <button
            type="button"
            onClick={() => {
              setSuche('')
              setStatus('alle')
              zuruecksetzen()
            }}
            className="mt-3 text-sm font-semibold text-teal-700 hover:underline"
          >
            Filter zurücksetzen
          </button>
        </div>
      ) : (
        <>
          {/* Mobile: Kartenliste (daumenfreundlich, ohne horizontales Scrollen) */}
          <ul className="flex flex-col gap-3 sm:hidden">
            {sichtbar.map((a) => {
              const href = `/admin/kunden/${encodeURIComponent(a.kunde_email)}`
              return (
                <li key={a.id}>
                  <Link
                    href={href}
                    className="flex min-h-12 flex-col gap-2.5 rounded-2xl border border-olive-200 bg-white p-4 transition-colors focus-visible:bg-teal-50 active:bg-olive-50"
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
                      <span className="ml-2 font-semibold text-teal-700">Details →</span>
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Ab sm: kompakte Tabelle */}
          <div className="hidden overflow-x-auto rounded-2xl ring-1 ring-olive-200 sm:block">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-olive-50 text-olive-500">
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Kunde</th>
                  <th className="px-5 py-3.5 font-semibold">Angebot</th>
                  <th className="px-5 py-3.5 font-semibold">Angelegt</th>
                  <th className="px-5 py-3.5 text-right font-semibold">
                    <span className="sr-only">Aktion</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-olive-100 bg-white">
                {sichtbar.map((a) => {
                  const href = `/admin/kunden/${encodeURIComponent(a.kunde_email)}`
                  const linkCls =
                    'block px-5 py-3.5 outline-none focus-visible:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-inset'
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-olive-50">
                      <td className="p-0">
                        <Link
                          href={href}
                          className={linkCls}
                          aria-label={`Vorgang ${a.angebot_nr} von ${a.kunde_firma} öffnen`}
                        >
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
                      <td className="p-0">
                        <Link href={href} className={`${linkCls} text-right font-semibold text-teal-700`} tabIndex={-1} aria-hidden>
                          Details →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Blättern */}
          {seiten > 1 && (
            <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Vorgänge blättern">
              <p className="text-xs text-olive-500 tabular-nums">
                {von + 1}–{Math.min(von + proSeite, gefiltert.length)} von {gefiltert.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSeite((s) => Math.max(1, s - 1))}
                  disabled={aktuelleSeite <= 1}
                  className="min-h-10 rounded-lg border border-olive-300 px-3 text-sm font-semibold text-mabe-900 hover:bg-olive-100 disabled:opacity-40"
                  aria-label="Vorherige Seite"
                >
                  ←
                </button>
                {seitenZahlen().map((n, i) =>
                  n === '…' ? (
                    <span key={`l-${i}`} className="px-1.5 text-sm text-olive-400" aria-hidden>
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSeite(n)}
                      aria-current={n === aktuelleSeite ? 'page' : undefined}
                      className={`min-h-10 min-w-10 rounded-lg px-2 text-sm font-semibold tabular-nums ${
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
                  onClick={() => setSeite((s) => Math.min(seiten, s + 1))}
                  disabled={aktuelleSeite >= seiten}
                  className="min-h-10 rounded-lg border border-olive-300 px-3 text-sm font-semibold text-mabe-900 hover:bg-olive-100 disabled:opacity-40"
                  aria-label="Nächste Seite"
                >
                  →
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
