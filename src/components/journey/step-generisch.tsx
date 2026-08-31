'use client'

import type { FeldDef, SchrittDef } from '@/lib/journey/types'
import { Feld, inputCls } from './ui'

/**
 * Rendert einen generischen Schritt rein aus seiner Felddefinition.
 * Neue Felder/Schritte in schritte.ts brauchen hier KEINE Code-Aenderung.
 */
export function StepGenerisch({
  schritt,
  daten,
  fehler,
  onChange,
}: {
  schritt: SchrittDef
  daten: Record<string, unknown>
  fehler: Record<string, string>
  onChange: (name: string, wert: unknown) => void
}) {
  const sichtbar = (feld: FeldDef) =>
    !feld.sichtbarWenn || daten[feld.sichtbarWenn.feld] === feld.sichtbarWenn.ist

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {(schritt.felder ?? [])
        .filter(sichtbar)
        .map((feld) => {
          const wert = (daten[feld.name] as string | number | undefined) ?? ''
          const common = {
            id: `f-${feld.name}`,
            className: inputCls,
            value: String(wert),
            placeholder: feld.placeholder,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(feld.name, e.target.value),
          }
          return (
            <div key={feld.name} className={feld.typ === 'iban' || feld.name === 'strasse' ? 'sm:col-span-2' : ''}>
              <Feld label={feld.label} hilfe={feld.hilfe} tooltip={feld.tooltip} fehler={fehler[feld.name]} pflicht={feld.pflicht}>
                {feld.typ === 'auswahl' ? (
                  <select {...common}>
                    <option value="">Bitte auswählen …</option>
                    {(feld.optionen ?? []).map((o) => (
                      <option key={o.wert} value={o.wert}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : feld.typ === 'datum' ? (
                  <input type="date" {...common} />
                ) : feld.typ === 'zahl' ? (
                  <input type="number" inputMode="decimal" min={0} {...common} />
                ) : (
                  <input
                    type={feld.typ === 'email' ? 'email' : 'text'}
                    inputMode={feld.typ === 'plz' ? 'numeric' : undefined}
                    autoComplete={feld.typ === 'email' ? 'email' : undefined}
                    {...common}
                  />
                )}
              </Feld>
            </div>
          )
        })}
    </div>
  )
}
