'use client'

import type { FeldDef, SchrittDef } from '@/lib/journey/types'
import { schemaFuerSchritt } from '@/lib/journey/schemas'
import { formatiereIban } from '@/lib/validierung'
import { Feld, inputCls } from './ui'

/**
 * Rendert einen generischen Schritt rein aus seiner Felddefinition.
 * Neue Felder/Schritte in schritte.ts brauchen hier KEINE Code-Aenderung.
 *
 * UX-Standard 2026:
 * - Autocomplete/enterkeyhint fuer Browser-Autofill (gerade mobil der
 *   groesste Tippzeit-Gewinn).
 * - Erfolgs-Haken am Feld (gruener Check), sobald der Inhalt valide ist –
 *   Fehler werden bestraft, korrekte Eingaben werden gefeiert.
 * - Visuelle Feldgruppen (feld.gruppe) als Chunking gegen Formular-Wände.
 * - Dezenter Shake bei Fehlern (einmalig, reduced-motion-sicher).
 */

/** Browser-Autofill je Feld (Vertrag: Feldname -> autocomplete-Token). */
const AUTOCOMPLETE: Record<string, string> = {
  unternehmensname: 'organization',
  email: 'email',
  ap_email: 'email',
  ap_vorname: 'given-name',
  ap_nachname: 'family-name',
  kontoinhaber: 'name',
  strasse: 'street-address',
  plz: 'postal-code',
  ort: 'address-level2',
  land: 'country-name',
  geburtsdatum: 'bday',
  standort_strasse: 'street-address',
  standort_plz: 'postal-code',
  standort_ort: 'address-level2',
}

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

function CheckIcon() {
  return (
    <span
      aria-hidden
      className="animate-check-pop pointer-events-none absolute top-1/2 right-3.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-teal-600 text-white"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-3">
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}

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

  // Ein Schema-Lauf pro Render: liefert die Menge der fachlich ungueltigen
  // Felder – alles andere mit Inhalt bekommt den Erfolgs-Haken.
  const parse = schemaFuerSchritt(schritt).safeParse(daten)
  const ungueltig = new Set(parse.success ? [] : parse.error.issues.map((i) => String(i.path[0])))
  const istGueltig = (name: string) => {
    const wert = daten[name]
    return wert !== undefined && wert !== null && String(wert).trim() !== '' && !ungueltig.has(name) && !fehler[name]
  }

  let letzteGruppe: string | undefined

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {(schritt.felder ?? [])
        .filter(sichtbar)
        .map((feld) => {
          const wert = (daten[feld.name] as string | number | undefined) ?? ''
          const gueltig = istGueltig(feld.name)
          const common = {
            id: `f-${feld.name}`,
            className: gueltig && feld.typ !== 'auswahl' ? `${inputCls} pr-10` : inputCls,
            value: String(wert),
            placeholder: feld.placeholder,
            enterKeyHint: 'next' as const,
            onBlur: () => onBlurFeld?.(feld.name),
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
              onChange(feld.name, bereinige(feld, e.target.value)),
          }
          const gruppenKopf =
            feld.gruppe && feld.gruppe !== letzteGruppe ? (letzteGruppe = feld.gruppe) : undefined
          return (
            <div key={feld.name} className="contents">
              {gruppenKopf && (
                <p className="col-span-full mt-2 -mb-1 border-t border-olive-100 pt-4 text-xs font-semibold tracking-wide text-olive-500 uppercase first:mt-0 first:border-0 first:pt-0">
                  {gruppenKopf}
                </p>
              )}
              <div
                className={`${feld.typ === 'iban' || feld.name === 'strasse' ? 'sm:col-span-2' : ''} ${
                  fehler[feld.name] ? 'motion-safe:animate-shake' : ''
                }`}
              >
                <Feld label={feld.label} hilfe={feld.hilfe} tooltip={feld.tooltip} fehler={fehler[feld.name]} pflicht={feld.pflicht}>
                  <div className="relative">
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
                        autoComplete={AUTOCOMPLETE[feld.name] ?? (feld.typ === 'email' ? 'email' : feld.typ === 'iban' ? 'off' : undefined)}
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
                    {gueltig && <CheckIcon />}
                  </div>
                </Feld>
              </div>
            </div>
          )
        })}
    </div>
  )
}
