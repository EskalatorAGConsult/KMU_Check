'use client'

import { useEffect, useState } from 'react'

import { WZ2008, wzCodeBezeichnung } from '@/lib/wz2008'

/**
 * WZ-Code-Feld mit offizieller Destatis-Liste (WZ 2008) als Autocomplete:
 * Der Kunde tippt Code ODER Branchenwort und sieht sofort die amtliche
 * Bezeichnung. Native <datalist> (mobilfreundlich, keine Custom-Dropdown-
 * Fehler). Nicht in der Liste gefundene Codes erzeugen nur einen weichen
 * Hinweis – die formale Validierung bleibt bei der Schema-Formatpruefung.
 */
export function WzCodeFeld({
  id,
  wert,
  onChange,
  className,
  onBlur,
}: {
  id: string
  wert: string
  onChange: (wert: string) => void
  className: string
  onBlur?: () => void
}) {
  // Liste erst nach der Hydration befuellen (1.835 Optionen – kein SSR-Ballast)
  const [bereit, setBereit] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setBereit(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const bezeichnung = wert.trim() ? wzCodeBezeichnung(wert) : null
  const zeigeHinweis = wert.trim().length >= 2 && !bezeichnung

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        className={className}
        value={wert}
        placeholder="Code oder Branche tippen, z. B. 28.29 oder „Maschinen“"
        list={bereit ? `${id}-liste` : undefined}
        autoComplete="off"
        maxLength={9}
        onChange={(e) => onChange(e.target.value.replace(/[^a-zA-Z0-9.]/g, '').toUpperCase().slice(0, 9))}
        onBlur={onBlur}
      />
      {bereit && (
        <datalist id={`${id}-liste`}>
          {Object.entries(WZ2008).map(([code, titel]) => (
            <option key={code} value={code}>
              {code} · {titel}
            </option>
          ))}
        </datalist>
      )}
      {bezeichnung && (
        <p className="animate-check-pop mt-1.5 flex items-start gap-1.5 text-xs/5 font-medium text-teal-800" role="status">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0" aria-hidden>
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            <span className="font-mono">{wert.trim().toUpperCase()}</span> – {bezeichnung}
          </span>
        </p>
      )}
      {zeigeHinweis && (
        <p className="mt-1.5 text-xs/5 text-amber-800" role="status">
          Dieser Code steht nicht in der offiziellen WZ-2008-Liste (Destatis) – bitte einmal gegen den
          Handelsregisterauszug oder das Steuerbüro prüfen.
        </p>
      )}
    </div>
  )
}
