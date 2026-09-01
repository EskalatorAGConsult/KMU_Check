'use client'

import { useState } from 'react'

import { openregisterVerbund } from '@/lib/openregister/actions'
import { personenartAusRechtsform } from '@/lib/openregister/mapping'

import { RegisterSuche } from './register-suche'

/**
 * Handelsregister-Prefill im Schritt „Ihr Unternehmen": Der Kunde sucht seine
 * Firma einmal, wir uebernehmen Name, Anschrift, WZ-Code und Personenart aus
 * dem offiziellen Handelsregister in die Formularfelder. Die Register-ID wird
 * im Schritt-Payload abgelegt, damit der KMU-Schritt Kennzahlen und Verbund
 * derselben Firma automatisch nachladen kann (Cache, keine Zusatz-Credits).
 *
 * Best effort: Fehler blockieren nie die manuelle Eingabe.
 */
export function UnternehmenSuche({
  token,
  uebernommenFirma,
  onChange,
}: {
  token: string
  /** Bereits vorbefuellte Firma (Draft-Fall), sonst null. */
  uebernommenFirma: string | null
  onChange: (name: string, wert: unknown) => void
}) {
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [bestaetigung, setBestaetigung] = useState<string | null>(uebernommenFirma)

  const waehlen = async (companyId: string) => {
    setLaedt(true)
    setFehler(null)
    const res = await openregisterVerbund(token, companyId)
    setLaedt(false)
    if (!res.ok) {
      setFehler(res.fehler)
      return
    }
    const u = res.ergebnis.unternehmen
    // Nur gefundene Werte schreiben – vorhandene Eingaben werden sonst nicht angeruehrt
    if (u.name) onChange('unternehmensname', u.name)
    if (u.strasse) onChange('strasse', u.strasse)
    if (u.plz) onChange('plz', u.plz)
    if (u.ort) onChange('ort', u.ort)
    if (u.plz || u.ort) onChange('land', 'Deutschland')
    if (u.wzCode) onChange('wz_code', u.wzCode)
    const personenart = personenartAusRechtsform(u.rechtsform)
    if (personenart) onChange('personenart', personenart)
    // Verknuepfung fuer den KMU-Schritt (wird bei finaler Validierung gestripped)
    onChange('register_id', companyId)
    setBestaetigung(u.name || null)
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
          Schneller fertig: Handelsregister-Abfrage
        </h3>
        <p className="text-sm/6 text-olive-700">
          Tippen Sie Ihren Firmennamen ein – wir übernehmen <strong className="text-mabe-900">Name, Anschrift,
          WZ-Code und Unternehmensform</strong> automatisch aus dem offiziellen Handelsregister. Im KMU-Schritt
          laden wir dann auch Beschäftigte und Beteiligungen Ihrer Firma vor. Kein Registereintrag
          (z. B. Einzelunternehmen)? Dann füllen Sie die Felder einfach von Hand aus.
        </p>
      </div>

      <RegisterSuche token={token} inputId="hr-suche-unternehmen" onWaehlen={(t) => void waehlen(t.companyId)} />

      {laedt && (
        <p className="flex items-center gap-2 rounded-xl border border-teal-600/20 bg-white px-4 py-3 text-sm text-olive-700" role="status">
          <svg className="size-4 animate-spin text-teal-700" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
          </svg>
          Lade Firmendaten aus dem Handelsregister …
        </p>
      )}

      {fehler && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200" role="alert">
          {fehler} Sie können die Angaben auch einfach manuell eintragen.
        </p>
      )}

      {bestaetigung && !laedt && (
        <p className="flex items-start gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 ring-1 ring-teal-600/20" role="status">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0" aria-hidden>
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            <strong>{bestaetigung}</strong> aus dem Handelsregister übernommen – bitte prüfen Sie die vorbefüllten
            Felder unten und ergänzen Sie E-Mail und Steuernummer.
          </span>
        </p>
      )}
    </section>
  )
}
