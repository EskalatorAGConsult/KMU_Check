'use client'

import { useEffect, useRef, useState } from 'react'

import { openregisterSuche } from '@/lib/openregister/actions'
import type { RegisterTreffer } from '@/lib/openregister/mapping'

import { inputCls } from './ui'

/**
 * Geteilte Handelsregister-Suche (Autocomplete, debounced) fuer die Journey.
 * Kapselt Eingabe, Trefferliste und Fehlerzustand; was mit der Auswahl
 * passiert, entscheidet die aufrufende Komponente ueber `onWaehlen`
 * (z. B. Stammdaten-Prefill im Unternehmen-Schritt oder Verbund-Abfrage
 * im KMU-Schritt).
 */
export function RegisterSuche({
  token,
  inputId,
  onWaehlen,
}: {
  token: string
  inputId: string
  onWaehlen: (treffer: RegisterTreffer) => void
}) {
  const [query, setQuery] = useState('')
  const [treffer, setTreffer] = useState<RegisterTreffer[] | null>(null)
  const [sucht, setSucht] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
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

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Unternehmen im Handelsregister suchen
        </label>
        <input
          id={inputId}
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

      {fehler && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200" role="alert">
          {fehler} Sie können die Angaben auch einfach manuell eintragen.
        </p>
      )}

      {treffer && (
        <ul className="flex flex-col gap-2" aria-label="Suchergebnisse">
          {treffer.length === 0 && (
            <li className="rounded-xl border border-olive-200 bg-white px-4 py-3 text-sm text-olive-600">
              Kein Treffer im Handelsregister – bitte die Angaben einfach manuell eintragen.
            </li>
          )}
          {treffer.map((t) => (
            <li key={t.companyId}>
              <button
                type="button"
                onClick={() => {
                  setTreffer(null)
                  setQuery(t.name)
                  onWaehlen(t)
                }}
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
    </div>
  )
}
