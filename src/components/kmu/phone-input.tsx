'use client'

import { clsx } from 'clsx/lite'
import { useMemo, useRef, useState } from 'react'

interface Country {
  name: string
  iso: string
  dial: string
}

// Kuratierte Länderliste – DACH zuerst, dann die wichtigsten EU-/Welt-Märkte.
const COUNTRIES: Country[] = [
  { name: 'Deutschland', iso: 'DE', dial: '+49' },
  { name: 'Österreich', iso: 'AT', dial: '+43' },
  { name: 'Schweiz', iso: 'CH', dial: '+41' },
  { name: 'Liechtenstein', iso: 'LI', dial: '+423' },
  { name: 'Luxemburg', iso: 'LU', dial: '+352' },
  { name: 'Niederlande', iso: 'NL', dial: '+31' },
  { name: 'Belgien', iso: 'BE', dial: '+32' },
  { name: 'Frankreich', iso: 'FR', dial: '+33' },
  { name: 'Italien', iso: 'IT', dial: '+39' },
  { name: 'Spanien', iso: 'ES', dial: '+34' },
  { name: 'Polen', iso: 'PL', dial: '+48' },
  { name: 'Tschechien', iso: 'CZ', dial: '+420' },
  { name: 'Slowakei', iso: 'SK', dial: '+421' },
  { name: 'Slowenien', iso: 'SI', dial: '+386' },
  { name: 'Dänemark', iso: 'DK', dial: '+45' },
  { name: 'Schweden', iso: 'SE', dial: '+46' },
  { name: 'Norwegen', iso: 'NO', dial: '+47' },
  { name: 'Finnland', iso: 'FI', dial: '+358' },
  { name: 'Vereinigtes Königreich', iso: 'GB', dial: '+44' },
  { name: 'Irland', iso: 'IE', dial: '+353' },
  { name: 'Portugal', iso: 'PT', dial: '+351' },
  { name: 'Ungarn', iso: 'HU', dial: '+36' },
  { name: 'Rumänien', iso: 'RO', dial: '+40' },
  { name: 'Kroatien', iso: 'HR', dial: '+385' },
  { name: 'Griechenland', iso: 'GR', dial: '+30' },
  { name: 'Vereinigte Staaten', iso: 'US', dial: '+1' },
  { name: 'Kanada', iso: 'CA', dial: '+1' },
  { name: 'Türkei', iso: 'TR', dial: '+90' },
]

/** Wandelt einen ISO-2-Ländercode in ein Flaggen-Emoji um. */
function isoToFlag(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

/** Gruppiert Ziffern in 3er/2er-Blöcke für bessere Lesbarkeit. */
function formatNational(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (!d) return ''
  const groups: string[] = []
  let i = 0
  // Erster Block (Vorwahl-Anmutung) 3–4 Ziffern, dann 3er/2er-Blöcke.
  groups.push(d.slice(0, 3))
  i = 3
  while (i < d.length) {
    groups.push(d.slice(i, i + 3))
    i += 3
  }
  return groups.filter(Boolean).join(' ')
}

export interface PhoneValue {
  iso: string
  dial: string
  national: string
  e164: string
  valid: boolean
}

export function PhoneInput({
  value,
  onChange,
  id,
  invalid,
}: {
  value: PhoneValue
  onChange: (v: PhoneValue) => void
  id?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const country = useMemo(() => COUNTRIES.find((c) => c.iso === value.iso) ?? COUNTRIES[0], [value.iso])
  const wrapRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso.toLowerCase().includes(q))
  }, [query])

  function emit(next: Partial<{ iso: string; dial: string; national: string }>) {
    const iso = next.iso ?? value.iso
    const dial = next.dial ?? country.dial
    const national = (next.national ?? value.national).replace(/\D/g, '')
    const e164 = national ? `${dial}${national}` : ''
    const valid = national.length >= 6 && national.length <= 14
    onChange({ iso, dial, national, e164, valid })
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div
        className={clsx(
          'flex items-stretch overflow-hidden rounded-xl border bg-white transition',
          invalid ? 'border-red-500 ring-2 ring-red-500/30' : 'border-olive-300 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/30',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Ländervorwahl auswählen"
          className="flex shrink-0 items-center gap-2 border-r border-olive-200 px-3 text-sm font-medium text-olive-950 hover:bg-olive-50"
        >
          <span className="text-lg leading-none" aria-hidden="true">
            {isoToFlag(country.iso)}
          </span>
          <span className="tabular-nums">{country.dial}</span>
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-olive-500">
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="151 23456789"
          value={formatNational(value.national)}
          onChange={(e) => emit({ national: e.target.value })}
          className="w-full bg-transparent px-3 py-3 text-base text-olive-950 outline-none placeholder:text-olive-400"
        />
      </div>

      {open && (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-olive-200 bg-white shadow-xl">
          <div className="sticky top-0 border-b border-olive-100 bg-white p-2">
            <input
              autoFocus
              data-skip-enter
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const first = filtered[0]
                  if (first) {
                    emit({ iso: first.iso, dial: first.dial })
                    setOpen(false)
                    setQuery('')
                  }
                }
              }}
              placeholder="Land suchen…"
              className="w-full rounded-lg border border-olive-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </div>
          <ul role="listbox">
            {filtered.map((c) => (
              <li key={c.iso + c.dial}>
                <button
                  type="button"
                  onClick={() => {
                    emit({ iso: c.iso, dial: c.dial })
                    setOpen(false)
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-teal-50"
                >
                  <span className="text-lg" aria-hidden="true">
                    {isoToFlag(c.iso)}
                  </span>
                  <span className="flex-1 text-olive-950">{c.name}</span>
                  <span className="tabular-nums text-olive-500">{c.dial}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-3 text-sm text-olive-500">Kein Treffer.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

export const DEFAULT_PHONE: PhoneValue = { iso: 'DE', dial: '+49', national: '', e164: '', valid: false }
