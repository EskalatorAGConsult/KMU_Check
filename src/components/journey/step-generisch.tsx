'use client'

import type { FeldDef, SchrittDef } from '@/lib/journey/types'
import { formatiereIban } from '@/lib/validierung'
import { Feld, inputCls } from './ui'

/**
 * Bereinigt die Eingabe typabhaengig schon waehrend des Tippens
 * (IBAN in Vierergruppen, nur Ziffern bei Steuer-ID/PLZ, …), damit
 * Zahlendreher und Formatfehler gar nicht erst entstehen.
 */
function bereinige(feld: FeldDef, roh: string): string {
  switch (feld.typ) {
    case 'iban': {
      const alnum = roh.replace(/[^a-zA-Z0-9]/g, '').slice(0, 34)
      return formatiereIban(alnum)
    }
    case 'steuer_id':
      return roh.replace(/\D/g, '').slice(0, 11)
    case 'plz':
      return roh.replace(/\D/g, '').slice(0, 5)
    case 'ust_id':
      return roh.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11)
    case 'wz_code':
      return roh.replace(/[^a-zA-Z0-9.]/g, '').toUpperCase().slice(0, 9)
    default:
      return roh
  }
}

function eingabeModus(feld: FeldDef): 'numeric' | 'decimal' | 'email' | undefined {
  if (feld.typ === 'plz' || feld.typ === 'steuer_id') return 'numeric'
  if (feld.typ === 'zahl') return 'decimal'
  if (feld.typ === 'email') return 'email'
  return undefined
}

/**
 * Rendert einen generischen Schritt rein aus seiner Felddefinition.
 * Neue Felder/Schritte in schritte.ts brauchen hier KEINE Code-Aenderung.
 */
export function StepGenerisch({
  schritt,
  daten,
  fehler,
  onChange,
  onBlurFeld,
}: {
  schritt: SchrittDef
  daten: Record<string, unknown>
  fehler: Record<string, string>
  onChange: (name: string, wert: unknown) => void
  /** Live-Validierung beim Verlassen eines Feldes (vom Wizard verdrahtet). */
  onBlurFeld?: (name: string) => void
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
            onBlur: () => onBlurFeld?.(feld.name),
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
              onChange(feld.name, bereinige(feld, e.target.value)),
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
                    inputMode={eingabeModus(feld)}
                    autoComplete={feld.typ === 'email' ? 'email' : feld.typ === 'iban' ? 'off' : undefined}
                    spellCheck={feld.typ === 'iban' || feld.typ === 'ust_id' ? false : undefined}
                    maxLength={
                      feld.typ === 'iban'
                        ? 42 // 34 Zeichen + 8 Trenn-Leerzeichen
                        : feld.typ === 'steuer_id'
                          ? 11
                          : feld.typ === 'plz'
                            ? 5
                            : feld.typ === 'ust_id'
                              ? 11
                              : feld.typ === 'wz_code'
                                ? 9
                                : undefined
                    }
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
