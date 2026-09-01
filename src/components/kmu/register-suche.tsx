'use client'

import { useEffect, useRef, useState } from 'react'

import type { RegisterTreffer, VerbundErgebnis } from '@/lib/openregister/mapping'
import { openregisterSucheOeffentlich, openregisterVerbundOeffentlich } from '@/lib/openregister/public-actions'
import { inputClass } from './field'

/**
 * Oeffentliche Handelsregister-Suche fuer den KMU-Schnellcheck auf der
 * Landingpage. Suche + Verbundabruf laufen ueber ratenlimitierte Server
 * Actions (public-actions.ts) – der API-Key bleibt serverseitig.
 *
 * Best effort: Bei Fehlern oder Nicht-Treffern bleibt der manuelle Weg
 * komplett offen.
 */
export function RegisterSuche({ onUebernehmen }: { onUebernehmen: (ergebnis: VerbundErgebnis) => void }) {
  const [query, setQuery] = useState('')
  const [treffer, setTreffer] = useState<RegisterTreffer[]>([])
  const [offen, setOffen] = useState(false)
  const [sucht, setSucht] = useState(false)
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [keinTreffer, setKeinTreffer] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const laufRef = useRef(0)

  // Eingabe-Handler: Resets gehoeren in den Event-Handler, nicht in den Effekt
  function aendereQuery(v: string) {
    setQuery(v)
    setKeinTreffer(false)
    setFehler(null)
    if (v.trim().length < 3) {
      setTreffer([])
      setOffen(false)
    }
  }

  // Debounced Suche (400 ms), ab 3 Zeichen
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) return
    const lauf = ++laufRef.current
    const timer = setTimeout(async () => {
      setSucht(true)
      try {
        const antwort = await openregisterSucheOeffentlich(q)
        if (lauf !== laufRef.current) return // veraltete Antwort verwerfen
        if (antwort.ok) {
          setTreffer(antwort.treffer.slice(0, 8))
          setOffen(antwort.treffer.length > 0)
          setKeinTreffer(antwort.treffer.length === 0)
        } else {
          setTreffer([])
          setOffen(false)
          setFehler(antwort.fehler)
        }
      } finally {
        if (lauf === laufRef.current) setSucht(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  // Klick außerhalb schließt die Trefferliste
  useEffect(() => {
    function schliessen(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOffen(false)
    }
    document.addEventListener('mousedown', schliessen)
    return () => document.removeEventListener('mousedown', schliessen)
  }, [])

  async function waehlen(t: RegisterTreffer) {
    setOffen(false)
    setQuery(t.name)
    setLaedt(true)
    setFehler(null)
    try {
      const antwort = await openregisterVerbundOeffentlich(t.companyId)
      if (antwort.ok) {
        onUebernehmen(antwort.ergebnis)
      } else {
        setFehler(antwort.fehler)
      }
    } finally {
      setLaedt(false)
    }
  }

  return (
    <div ref={boxRef} className="relative rounded-2xl border border-teal-600/25 bg-teal-50/40 p-4 sm:p-5">
      <label htmlFor="register-suche" className="block text-sm font-semibold text-mabe-900">
        Schnellstart: Unternehmen im Handelsregister suchen{' '}
        <span className="font-normal text-olive-500">(optional)</span>
      </label>
      <p className="mt-1 text-xs/5 text-olive-600">
        Wir füllen Beschäftigte, Finanzzahlen und Beteiligungsverhältnisse automatisch vor – Sie prüfen die Werte
        anschließend nur noch. Kein Eintrag im Handelsregister (z. B. Einzelunternehmen)? Einfach darunter von Hand
        eingeben.
      </p>
      <div className="relative mt-3">
        <input
          id="register-suche"
          data-skip-enter
          className={inputClass}
          placeholder="Firmenname eingeben, z. B. Muster Maschinenbau"
          value={query}
          onChange={(e) => aendereQuery(e.target.value)}
          onFocus={() => treffer.length > 0 && setOffen(true)}
          autoComplete="off"
          role="combobox"
          aria-expanded={offen}
          aria-controls="register-treffer"
          aria-autocomplete="list"
        />
        {(sucht || laedt) && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center" aria-hidden>
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 animate-spin text-teal-700">
              <path
                fillRule="evenodd"
                d="M10 2a8 8 0 1 0 8 8 .75.75 0 0 1 1.5 0A9.5 9.5 0 1 1 10 .5.75.75 0 0 1 10 2Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
        {offen && treffer.length > 0 && (
          <ul
            id="register-treffer"
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-olive-200 bg-white py-1 shadow-lg"
          >
            {treffer.map((t) => (
              <li key={t.companyId} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => void waehlen(t)}
                  className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-teal-50 focus:bg-teal-50 focus:outline-none"
                >
                  <span className="text-sm font-semibold text-mabe-900">
                    {t.name}
                    {t.rechtsform ? ` ${t.rechtsform}` : ''}
                    {!t.aktiv && <span className="ml-2 text-xs font-normal text-red-600">(erloschen)</span>}
                  </span>
                  <span className="text-xs text-olive-500">
                    {[t.adresse, t.registerLabel].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {laedt && (
        <p className="mt-2 text-xs/5 font-medium text-teal-800" role="status">
          Lade Registerdaten und Beteiligungskette …
        </p>
      )}
      {keinTreffer && !sucht && (
        <p className="mt-2 text-xs/5 text-olive-500" role="status">
          Kein Treffer im Handelsregister – dann einfach unten manuell weiter.
        </p>
      )}
      {fehler && (
        <p className="mt-2 text-xs/5 font-medium text-red-700" role="alert">
          {fehler}
        </p>
      )}
    </div>
  )
}
