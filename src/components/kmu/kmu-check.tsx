'use client'

import { clsx } from 'clsx/lite'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { CompanyInput, Holding, KmuResult } from '@/lib/kmu'
import { evaluateKmu } from '@/lib/kmu'
import { generateKmuPdf, downloadBlob, type LeadInfo } from '@/lib/pdf'
import { collectTracking, enrichWithFingerprint, type TrackingData } from '@/lib/tracking'
import { Field, NumberField, inputClass } from './field'
import { LiveEvaluation } from './live-evaluation'
import { DEFAULT_PHONE, PhoneInput, type PhoneValue } from './phone-input'

/* --------------------------------------------------------------------- */
/*  Hilfsfunktionen                                                       */
/* --------------------------------------------------------------------- */

/** Parst deutsche Zahlformate ("1.250.000", "2,5 Mio" wird nicht interpretiert). */
function parseDe(s: string): number {
  if (!s) return 0
  const cleaned = s.replace(/[^\d.,]/g, '')
  if (!cleaned) return 0
  // Wenn Komma als Dezimaltrenner: Punkte = Tausender entfernen, Komma -> Punkt
  let normalized = cleaned
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    normalized = cleaned.replace(/\./g, '')
  }
  const n = parseFloat(normalized)
  return isFinite(n) ? n : 0
}

function isValidEmail(email: string): boolean {
  const e = email.trim()
  // Pragmatische, robuste Validierung + Domain mit Punkt.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
}

type Direction = 'we_hold' | 'holds_us'

interface UIHolding extends Holding {
  direction: Direction
}

function newHolding(): UIHolding {
  return {
    id: Math.random().toString(36).slice(2),
    name: '',
    direction: 'we_hold',
    sharePct: 50,
    employees: 0,
    turnover: 0,
    balanceSheet: 0,
  }
}

/* --------------------------------------------------------------------- */
/*  Schritt-Definition                                                    */
/* --------------------------------------------------------------------- */

type StepId = 'name' | 'employees' | 'financials' | 'holdingsQuestion' | 'holdings' | 'summary' | 'lead'

/* --------------------------------------------------------------------- */
/*  Hauptkomponente                                                       */
/* --------------------------------------------------------------------- */

export function KmuCheck() {
  // Unternehmensdaten (numerische Felder als Strings für freie Eingabe)
  const [companyName, setCompanyName] = useState('')
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear() - 1))
  const [employees, setEmployees] = useState('')
  const [turnover, setTurnover] = useState('')
  const [balanceSheet, setBalanceSheet] = useState('')
  const [hasHoldings, setHasHoldings] = useState<boolean | null>(null)
  const [holdings, setHoldings] = useState<UIHolding[]>([])

  // Lead-Daten
  const [salutation, setSalutation] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [position, setPosition] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState<PhoneValue>(DEFAULT_PHONE)
  const [consent, setConsent] = useState(false)

  const [stepIndex, setStepIndex] = useState(0)
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  const trackingRef = useRef<TrackingData | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  // Tracking beim Mount erfassen + asynchron mit Fingerprint anreichern.
  useEffect(() => {
    const data = collectTracking()
    trackingRef.current = data
    enrichWithFingerprint(data).then((d) => {
      trackingRef.current = d
    })
  }, [])

  // Dynamische Schrittliste – „holdings“ nur wenn Beteiligungen vorhanden.
  const steps = useMemo<StepId[]>(() => {
    const base: StepId[] = ['name', 'employees', 'financials', 'holdingsQuestion']
    if (hasHoldings) base.push('holdings')
    base.push('summary', 'lead')
    return base
  }, [hasHoldings])

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)]

  // Live-Berechnung
  const input: CompanyInput = useMemo(
    () => ({
      companyName,
      fiscalYear: Number(fiscalYear),
      employees: parseDe(employees),
      turnover: parseDe(turnover),
      balanceSheet: parseDe(balanceSheet),
      holdings: hasHoldings ? holdings : [],
    }),
    [companyName, fiscalYear, employees, turnover, balanceSheet, hasHoldings, holdings],
  )

  const hasAnyInput = employees !== '' || turnover !== '' || balanceSheet !== ''
  const result: KmuResult | null = useMemo(() => (hasAnyInput ? evaluateKmu(input) : null), [input, hasAnyInput])

  /* ---- Validierung pro Schritt ---- */
  function stepValid(step: StepId): boolean {
    switch (step) {
      case 'name':
        return companyName.trim().length >= 2
      case 'employees':
        return employees.trim() !== '' && parseDe(employees) >= 0
      case 'financials':
        return parseDe(turnover) > 0 || parseDe(balanceSheet) > 0
      case 'holdingsQuestion':
        return hasHoldings !== null
      case 'holdings':
        return holdings.length > 0 && holdings.every((h) => h.name.trim() !== '' && h.sharePct >= 25)
      case 'summary':
        return true
      case 'lead':
        return (
          firstName.trim() !== '' &&
          lastName.trim() !== '' &&
          isValidEmail(email) &&
          phone.valid &&
          consent
        )
      default:
        return true
    }
  }

  function goNext() {
    if (!stepValid(currentStep)) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    if (currentStep === 'lead') {
      void submit()
      return
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
    scrollTop()
  }

  function goBack() {
    setShowErrors(false)
    setStepIndex((i) => Math.max(i - 1, 0))
    scrollTop()
  }

  // Enter im Formular = „Weiter“ (außer in mehrzeiligen Feldern / Sucheingaben).
  function handleFormKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return
    const el = e.target as HTMLElement
    if (el.tagName !== 'INPUT') return
    const input = el as HTMLInputElement
    if (input.type === 'checkbox' || input.type === 'radio') return
    if (input.dataset.skipEnter !== undefined) return
    e.preventDefault()
    goNext()
  }

  function scrollTop() {
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const leadInfo: LeadInfo = { salutation, firstName, lastName, position, email, phone: phone.e164 }

  async function submit() {
    if (!result) return
    setSubmitting(true)
    const payload = {
      type: 'kmu_check_lead',
      submitted_at: new Date().toISOString(),
      company: {
        name: companyName,
        fiscalYear: Number(fiscalYear),
        employees: parseDe(employees),
        turnover: parseDe(turnover),
        balanceSheet: parseDe(balanceSheet),
      },
      holdings: holdings.map((h) => ({
        name: h.name,
        direction: h.direction,
        sharePct: h.sharePct,
        relationship: h.sharePct > 50 ? 'linked' : 'partner',
        employees: h.employees,
        turnover: h.turnover,
        balanceSheet: h.balanceSheet,
      })),
      result: {
        category: result.category,
        categoryLabel: result.categoryLabel,
        isKmu: result.isKmu,
        fundingRatePct: result.fundingRatePct,
        consolidated: result.consolidated,
        own: result.own,
        partnerContribution: result.partnerContribution,
        linkedContribution: result.linkedContribution,
      },
      lead: {
        salutation,
        firstName,
        lastName,
        position,
        email: email.trim(),
        phone: phone.e164,
        phoneCountry: phone.iso,
        consent,
      },
      tracking: trackingRef.current,
    }

    try {
      await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      })
    } catch {
      // Erfolgsanzeige trotzdem zeigen – Lead lokal nicht verlieren.
    } finally {
      setSubmitting(false)
      setDone(true)
      scrollTop()
    }
  }

  async function handlePdf() {
    if (!result) return
    setPdfBusy(true)
    try {
      const blob = await generateKmuPdf(input, result, done ? leadInfo : undefined)
      downloadBlob(blob, `KMU-Foerdercheck_${(companyName || 'Unternehmen').replace(/[^\w]+/g, '_')}.pdf`)
    } finally {
      setPdfBusy(false)
    }
  }

  /* ---- Fortschritt ---- */
  const totalSteps = steps.length
  const progress = done ? 100 : Math.round((stepIndex / totalSteps) * 100)

  return (
    <div ref={topRef} id="kmu-check" className="scroll-mt-28">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:items-start">
        {/* ----------------------------- Formular ----------------------------- */}
        <div className="lg:col-span-3">
          <div onKeyDown={handleFormKeyDown} className="rounded-3xl border border-olive-200 bg-white p-6 shadow-sm sm:p-8">
            {done ? (
              <SuccessPanel
                result={result}
                companyName={companyName}
                onPdf={handlePdf}
                pdfBusy={pdfBusy}
              />
            ) : (
              <>
                {/* Fortschritt */}
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between text-xs font-medium text-olive-500">
                    <span>
                      Schritt {Math.min(stepIndex + 1, totalSteps)} von {totalSteps}
                    </span>
                    <span className="tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-olive-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-mabe-700 to-teal-500 transition-all duration-500"
                      style={{ width: `${Math.max(6, progress)}%` }}
                    />
                  </div>
                </div>

                {/* Schrittinhalt – sanfter Übergang bei jedem Schrittwechsel */}
                <div key={currentStep} className="min-h-[18rem] animate-step-in">
                  {currentStep === 'name' && (
                    <Step
                      kicker="Los geht's"
                      title="Für welches Unternehmen prüfen wir?"
                      subtitle="In rund 3 Minuten wissen Sie, ob Sie als KMU gelten – und welche Förderquote möglich ist. Keine Anmeldung nötig."
                    >
                      <Field
                        label="Name des Unternehmens"
                        htmlFor="companyName"
                        required
                        why="Wir nutzen den Namen ausschließlich für Ihre persönliche Auswertung und den PDF-Nachweis. So können Sie das Ergebnis später eindeutig zuordnen."
                      >
                        <input
                          id="companyName"
                          className={clsx(inputClass, showErrors && !stepValid('name') && 'border-red-500 ring-2 ring-red-500/30')}
                          placeholder="z. B. Muster Maschinenbau GmbH"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          autoFocus
                        />
                      </Field>
                      <TrustRow />
                    </Step>
                  )}

                  {currentStep === 'employees' && (
                    <Step
                      kicker="Kriterium 1 von 2"
                      title="Wie viele Mitarbeitende beschäftigt das Unternehmen?"
                      subtitle="Maßgeblich sind Jahresarbeitseinheiten (JAE) – also Vollzeitäquivalente des letzten abgeschlossenen Geschäftsjahres."
                    >
                      <Field
                        label="Beschäftigte in Jahresarbeitseinheiten (JAE)"
                        htmlFor="employees"
                        required
                        why={
                          <>
                            <p className="font-semibold">Was ist eine Jahresarbeitseinheit (JAE)?</p>
                            <p className="mt-1">
                              Eine JAE entspricht einer Person, die ein ganzes Jahr in Vollzeit beschäftigt war.
                              Teilzeit, Saison- und Aushilfskräfte zählen anteilig. Auszubildende und Personen in
                              Mutterschafts-/Elternzeit werden nicht mitgezählt. Die Mitarbeiterzahl ist das
                              <strong> bindende</strong> Kriterium der KMU-Definition.
                            </p>
                          </>
                        }
                        hint="Tipp: Teilzeit anteilig zählen (z. B. eine 50 %-Stelle = 0,5 JAE)."
                      >
                        <NumberField
                          id="employees"
                          value={employees}
                          onChange={setEmployees}
                          placeholder="z. B. 42"
                          suffix="JAE"
                          invalid={showErrors && !stepValid('employees')}
                        />
                      </Field>
                    </Step>
                  )}

                  {currentStep === 'financials' && (
                    <Step
                      kicker="Kriterium 2 von 2"
                      title="Wie sehen die Finanzkennzahlen aus?"
                      subtitle="Es genügt, wenn EINER der beiden Werte innerhalb der Grenze liegt. Geben Sie idealerweise beide an – wir rechnen mit dem für Sie günstigeren Wert."
                    >
                      <Field
                        label="Letztes abgeschlossenes / veröffentlichtes Geschäftsjahr"
                        htmlFor="fiscalYear"
                        required
                        why="Die KMU-Einstufung erfolgt anhand der Zahlen des letzten abgeschlossenen (bzw. veröffentlichten/festgestellten) Geschäftsjahres. Mitarbeitende, Umsatz und Bilanzsumme sollten sich alle auf dieses Jahr beziehen."
                        hint="Bei einem Rumpf- oder ersten Geschäftsjahr ohne Abschluss: das laufende Jahr nach Treu und Glauben schätzen."
                      >
                        <select
                          id="fiscalYear"
                          value={fiscalYear}
                          onChange={(e) => setFiscalYear(e.target.value)}
                          className={inputClass}
                        >
                          {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                          label="Jahresumsatz"
                          htmlFor="turnover"
                          why="Der Jahresumsatz (netto) des letzten abgeschlossenen Geschäftsjahres. Zusammen mit Mitarbeiterzahl und Bilanzsumme bestimmt er Ihre Größenklasse."
                        >
                          <NumberField
                            id="turnover"
                            value={turnover}
                            onChange={setTurnover}
                            placeholder="z. B. 8.500.000"
                            suffix="€"
                            invalid={showErrors && !stepValid('financials')}
                          />
                        </Field>
                        <Field
                          label="Bilanzsumme"
                          htmlFor="balance"
                          why="Die Bilanzsumme ist die Summe aller Aktiva (Anlage- + Umlaufvermögen) Ihrer letzten Jahresbilanz. Für die KMU-Prüfung reicht es, wenn Umsatz ODER Bilanzsumme die Grenze einhält."
                        >
                          <NumberField
                            id="balance"
                            value={balanceSheet}
                            onChange={setBalanceSheet}
                            placeholder="z. B. 6.200.000"
                            suffix="€"
                            invalid={showErrors && !stepValid('financials')}
                          />
                        </Field>
                      </div>
                      {showErrors && !stepValid('financials') && (
                        <p className="text-sm text-red-600">Bitte geben Sie mindestens einen der beiden Werte an.</p>
                      )}
                    </Step>
                  )}

                  {currentStep === 'holdingsQuestion' && (
                    <Step
                      kicker="Verbund prüfen"
                      title="Gibt es Beteiligungen von mehr als 25 %?"
                      subtitle="Für den KMU-Status zählt nicht nur Ihr Unternehmen allein, sondern der gesamte Verbund. Das wird sehr oft übersehen – und entscheidet über Ihre Förderquote."
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <ChoiceCard
                          active={hasHoldings === true}
                          onClick={() => {
                            setHasHoldings(true)
                            if (holdings.length === 0) setHoldings([newHolding()])
                          }}
                          title="Ja, es gibt Beteiligungen"
                          desc="Ihr Unternehmen hält ≥ 25 % an anderen Firmen oder andere halten ≥ 25 % an Ihnen."
                        />
                        <ChoiceCard
                          active={hasHoldings === false}
                          onClick={() => setHasHoldings(false)}
                          title="Nein, eigenständig"
                          desc="Keine Beteiligung von 25 % oder mehr in eine der beiden Richtungen."
                        />
                      </div>
                      <InfoBox>
                        <strong>Partner (25–50 %)</strong> werden anteilig zugerechnet,{' '}
                        <strong>verbundene Unternehmen (&gt; 50 %)</strong> zu 100 %. Beteiligungen unter 25 % bleiben
                        unberücksichtigt. Auch Beteiligungen, die jemand <em>an Ihnen</em> hält, zählen mit.
                      </InfoBox>
                    </Step>
                  )}

                  {currentStep === 'holdings' && (
                    <Step
                      kicker="Verbund erfassen"
                      title="Erfassen Sie die Beteiligungen"
                      subtitle="Pro Beteiligung benötigen wir Anteil, Mitarbeitende und Finanzkennzahlen. Wir rechnen sofort live um – Sie sehen die Wirkung rechts."
                    >
                      <div className="flex flex-col gap-5">
                        {holdings.map((h, idx) => (
                          <HoldingCard
                            key={h.id}
                            holding={h}
                            index={idx}
                            showErrors={showErrors}
                            onChange={(patch) =>
                              setHoldings((arr) => arr.map((x) => (x.id === h.id ? { ...x, ...patch } : x)))
                            }
                            onRemove={() => setHoldings((arr) => arr.filter((x) => x.id !== h.id))}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setHoldings((arr) => [...arr, newHolding()])}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-olive-300 px-4 py-3 text-sm font-medium text-mabe-800 hover:border-teal-600 hover:bg-teal-50"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
                            <path d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z" />
                          </svg>
                          Weitere Beteiligung hinzufügen
                        </button>
                      </div>
                    </Step>
                  )}

                  {currentStep === 'summary' && (
                    <Step
                      kicker="Geschafft"
                      title="Ihr Ergebnis steht fest"
                      subtitle="Hier sehen Sie Ihre Angaben im Überblick. Im nächsten Schritt sichern Sie sich den PDF-Nachweis und eine kostenlose Ersteinschätzung zur Förderung."
                    >
                      <SummaryList
                        companyName={companyName}
                        fiscalYear={fiscalYear}
                        employees={parseDe(employees)}
                        turnover={parseDe(turnover)}
                        balanceSheet={parseDe(balanceSheet)}
                        holdings={holdings}
                        result={result}
                        onEdit={(target) => {
                          const idx = steps.indexOf(target)
                          if (idx >= 0) setStepIndex(idx)
                          scrollTop()
                        }}
                      />
                    </Step>
                  )}

                  {currentStep === 'lead' && (
                    <Step
                      kicker="Letzter Schritt"
                      title="Wohin dürfen wir Ihr Ergebnis senden?"
                      subtitle="Sie erhalten den PDF-Nachweis und eine unverbindliche Einschätzung, welche Förderungen für Ihr Unternehmen in Frage kommen."
                    >
                      <div className="flex flex-col gap-5">
                        <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
                          <Field label="Anrede" htmlFor="salutation">
                            <select
                              id="salutation"
                              value={salutation}
                              onChange={(e) => setSalutation(e.target.value)}
                              className={inputClass}
                            >
                              <option value="">–</option>
                              <option>Herr</option>
                              <option>Frau</option>
                              <option>Divers</option>
                            </select>
                          </Field>
                          <Field label="Position / Funktion" htmlFor="position">
                            <input
                              id="position"
                              className={inputClass}
                              placeholder="z. B. Geschäftsführung"
                              value={position}
                              onChange={(e) => setPosition(e.target.value)}
                            />
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Vorname" htmlFor="firstName" required>
                            <input
                              id="firstName"
                              className={clsx(inputClass, showErrors && firstName.trim() === '' && 'border-red-500 ring-2 ring-red-500/30')}
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              autoComplete="given-name"
                            />
                          </Field>
                          <Field label="Nachname" htmlFor="lastName" required>
                            <input
                              id="lastName"
                              className={clsx(inputClass, showErrors && lastName.trim() === '' && 'border-red-500 ring-2 ring-red-500/30')}
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              autoComplete="family-name"
                            />
                          </Field>
                        </div>
                        <Field
                          label="Geschäftliche E-Mail"
                          htmlFor="email"
                          required
                          why="An diese Adresse senden wir Ihren KMU-Nachweis und die Förder-Ersteinschätzung. Wir geben Ihre Daten nicht an Dritte weiter."
                        >
                          <input
                            id="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            className={clsx(
                              inputClass,
                              showErrors && !isValidEmail(email) && 'border-red-500 ring-2 ring-red-500/30',
                            )}
                            placeholder="name@unternehmen.de"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </Field>
                        <Field
                          label="Telefon"
                          htmlFor="phone"
                          required
                          why="Für kurze Rückfragen zur Förderfähigkeit. Ein Anruf spart oft Wochen – gerade bei Fristen und Antragsformalitäten."
                        >
                          <PhoneInput
                            id="phone"
                            value={phone}
                            onChange={setPhone}
                            invalid={showErrors && !phone.valid}
                          />
                        </Field>

                        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-olive-50 p-4 text-sm text-olive-700">
                          <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                            className="mt-0.5 size-5 shrink-0 rounded border-olive-300 text-teal-600 focus:ring-teal-600"
                          />
                          <span>
                            Ich willige ein, dass die MABE Maschinen- und Behälterbau GmbH meine Angaben zur Bearbeitung
                            meiner Anfrage und Kontaktaufnahme verarbeitet. Die{' '}
                            <a href="#datenschutz" className="font-medium text-teal-700 underline">
                              Datenschutzhinweise
                            </a>{' '}
                            habe ich zur Kenntnis genommen. Widerruf jederzeit möglich.{' '}
                            <span className="text-teal-700">*</span>
                          </span>
                        </label>
                        {showErrors && !stepValid('lead') && (
                          <p className="text-sm text-red-600">
                            Bitte füllen Sie alle Pflichtfelder korrekt aus und bestätigen Sie die Einwilligung.
                          </p>
                        )}
                      </div>
                    </Step>
                  )}
                </div>

                {/* Navigation */}
                <div className="mt-8 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={stepIndex === 0}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-olive-700 hover:bg-olive-100 disabled:invisible"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                      <path
                        fillRule="evenodd"
                        d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.24a.75.75 0 0 1 0-1.06l4.25-4.24a.75.75 0 0 1 1.06 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Zurück
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-full bg-mabe-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition transition-smooth hover:scale-[1.02] hover:bg-mabe-800 active:scale-95 disabled:opacity-60"
                  >
                    {submitting ? (
                      'Wird gesendet…'
                    ) : currentStep === 'lead' ? (
                      <>Ergebnis & PDF anfordern</>
                    ) : currentStep === 'summary' ? (
                      <>Ergebnis sichern</>
                    ) : (
                      <>
                        Weiter
                        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                          <path
                            fillRule="evenodd"
                            d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.94 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.24a.75.75 0 0 1 0 1.06l-4.25 4.24a.75.75 0 0 1-1.06 0Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* --------------------------- Live-Auswertung --------------------------- */}
        <div className="lg:col-span-2 lg:sticky lg:top-28">
          <LiveEvaluation result={result} hasInput={hasAnyInput} />
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- */
/*  Teil-Komponenten                                                      */
/* --------------------------------------------------------------------- */

function Step({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wide text-teal-700 uppercase">{kicker}</span>
        <h3 className="font-display text-2xl/8 font-semibold text-mabe-900 sm:text-3xl/9">{title}</h3>
        <p className="text-sm/6 text-olive-600">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  )
}

function TrustRow() {
  const items = ['Kostenlos & unverbindlich', 'Keine Anmeldung', 'PDF-Nachweis inklusive']
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
      {items.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5 text-xs font-medium text-olive-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-teal-600">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
          {t}
        </li>
      ))}
    </ul>
  )
}

function ChoiceCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean
  onClick: () => void
  title: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex flex-col gap-1.5 rounded-2xl border-2 p-5 text-left transition transition-smooth hover:scale-[1.01] active:scale-[0.99]',
        active ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-600/20' : 'border-olive-200 bg-white hover:border-olive-300',
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={clsx(
            'flex size-5 items-center justify-center rounded-full border-2',
            active ? 'border-teal-600 bg-teal-600' : 'border-olive-300',
          )}
        >
          {active && (
            <svg viewBox="0 0 20 20" fill="white" className="size-3.5">
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </span>
        <span className="font-semibold text-olive-950">{title}</span>
      </span>
      <span className="text-sm text-olive-600">{desc}</span>
    </button>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-mabe-50 px-4 py-3 text-sm text-mabe-900 ring-1 ring-mabe-600/15">
      <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-5 shrink-0 text-mabe-600">
        <path
          fillRule="evenodd"
          d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
          clipRule="evenodd"
        />
      </svg>
      <p>{children}</p>
    </div>
  )
}

function HoldingCard({
  holding,
  index,
  showErrors,
  onChange,
  onRemove,
}: {
  holding: UIHolding
  index: number
  showErrors: boolean
  onChange: (patch: Partial<UIHolding>) => void
  onRemove: () => void
}) {
  const relationship = holding.sharePct > 50 ? 'Verbunden · 100 %' : `Partner · anteilig ${Math.round(holding.sharePct)} %`
  return (
    <div className="rounded-2xl border border-olive-200 bg-olive-50/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-olive-950">
          <span className="flex size-6 items-center justify-center rounded-full bg-mabe-900 text-xs text-white">
            {index + 1}
          </span>
          Beteiligung
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              holding.sharePct > 50 ? 'bg-mabe-100 text-mabe-800' : 'bg-teal-100 text-teal-800',
            )}
          >
            {relationship}
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Beteiligung entfernen"
          className="rounded-full p-1.5 text-olive-500 hover:bg-red-50 hover:text-red-600"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443A28.97 28.97 0 0 0 2.5 4.5a.75.75 0 0 0 0 1.5h.227l.706 11.31A2.75 2.75 0 0 0 6.178 19h7.644a2.75 2.75 0 0 0 2.745-2.69L17.273 6H17.5a.75.75 0 0 0 0-1.5 28.97 28.97 0 0 0-3.5-.307V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name der Beteiligung" htmlFor={`h-name-${holding.id}`} required>
          <input
            id={`h-name-${holding.id}`}
            className={clsx(inputClass, showErrors && holding.name.trim() === '' && 'border-red-500 ring-2 ring-red-500/30')}
            placeholder="z. B. Tochter GmbH"
            value={holding.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field label="Beziehung" htmlFor={`h-dir-${holding.id}`}>
          <select
            id={`h-dir-${holding.id}`}
            className={inputClass}
            value={holding.direction}
            onChange={(e) => onChange({ direction: e.target.value as Direction })}
          >
            <option value="we_hold">Wir halten Anteile an dieser Firma</option>
            <option value="holds_us">Diese Firma/Person hält Anteile an uns</option>
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <label htmlFor={`h-share-${holding.id}`} className="font-semibold text-olive-950">
            Beteiligungsquote
          </label>
          <span className="font-bold text-mabe-900 tabular-nums">{Math.round(holding.sharePct)} %</span>
        </div>
        <input
          id={`h-share-${holding.id}`}
          type="range"
          min={25}
          max={100}
          step={1}
          value={holding.sharePct}
          onChange={(e) => onChange({ sharePct: Number(e.target.value) })}
          className="w-full accent-teal-600"
        />
        <div className="mt-1 flex justify-between text-[11px] text-olive-500">
          <span>25 % (anteilig)</span>
          <span>50 %</span>
          <span>100 % (voll)</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="JAE" htmlFor={`h-emp-${holding.id}`}>
          <NumberField
            id={`h-emp-${holding.id}`}
            value={holding.employees ? String(holding.employees) : ''}
            onChange={(v) => onChange({ employees: parseDe(v) })}
            placeholder="0"
            suffix="MA"
          />
        </Field>
        <Field label="Umsatz" htmlFor={`h-turn-${holding.id}`}>
          <NumberField
            id={`h-turn-${holding.id}`}
            value={holding.turnover ? String(holding.turnover) : ''}
            onChange={(v) => onChange({ turnover: parseDe(v) })}
            placeholder="0"
            suffix="€"
          />
        </Field>
        <Field label="Bilanzsumme" htmlFor={`h-bal-${holding.id}`}>
          <NumberField
            id={`h-bal-${holding.id}`}
            value={holding.balanceSheet ? String(holding.balanceSheet) : ''}
            onChange={(v) => onChange({ balanceSheet: parseDe(v) })}
            placeholder="0"
            suffix="€"
          />
        </Field>
      </div>
    </div>
  )
}

function SummaryList({
  companyName,
  fiscalYear,
  employees,
  turnover,
  balanceSheet,
  holdings,
  result,
  onEdit,
}: {
  companyName: string
  fiscalYear: string
  employees: number
  turnover: number
  balanceSheet: number
  holdings: UIHolding[]
  result: KmuResult | null
  onEdit: (step: StepId) => void
}) {
  const fmtE = (n: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const Row = ({ label, value, step }: { label: string; value: string; step: StepId }) => (
    <div className="flex items-center justify-between gap-3 border-b border-olive-100 py-3 last:border-0">
      <span className="text-sm text-olive-600">{label}</span>
      <span className="flex items-center gap-3">
        <span className="text-sm font-semibold text-olive-950">{value}</span>
        <button type="button" onClick={() => onEdit(step)} className="text-xs font-medium text-teal-700 hover:underline">
          Ändern
        </button>
      </span>
    </div>
  )
  return (
    <div className="rounded-2xl border border-olive-200 bg-white p-1 sm:p-2">
      <div className="px-4">
        <Row label="Unternehmen" value={companyName || '–'} step="name" />
        <Row label="Geschäftsjahr" value={fiscalYear} step="financials" />
        <Row label="Beschäftigte (JAE)" value={new Intl.NumberFormat('de-DE').format(employees)} step="employees" />
        <Row label="Jahresumsatz" value={turnover ? fmtE(turnover) : '–'} step="financials" />
        <Row label="Bilanzsumme" value={balanceSheet ? fmtE(balanceSheet) : '–'} step="financials" />
        <Row
          label="Beteiligungen"
          value={holdings.length ? `${holdings.length} erfasst` : 'keine'}
          step="holdingsQuestion"
        />
        {result && (
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm font-semibold text-olive-950">Einstufung</span>
            <span className="rounded-full bg-mabe-900 px-3 py-1 text-sm font-semibold text-white">
              {result.categoryLabel} · {result.fundingRatePct} %
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function SuccessPanel({
  result,
  companyName,
  onPdf,
  pdfBusy,
}: {
  result: KmuResult | null
  companyName: string
  onPdf: () => void
  pdfBusy: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-teal-100">
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-9 text-teal-600">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-3xl font-semibold text-mabe-900">Vielen Dank!</h3>
        <p className="max-w-md text-sm/6 text-olive-600">
          Ihr KMU-Check für <strong>{companyName || 'Ihr Unternehmen'}</strong> ist abgeschlossen. Wir haben Ihre
          Ergebnisse erfasst und melden uns mit einer Förder-Ersteinschätzung. Ihren Nachweis können Sie sofort
          herunterladen.
        </p>
      </div>

      {result && (
        <div className="w-full rounded-2xl bg-olive-50 p-5">
          <div className="text-xs font-semibold tracking-wide text-olive-500 uppercase">Ihr Ergebnis</div>
          <div className="mt-1 flex items-center justify-center gap-3">
            <span className="font-display text-2xl font-semibold text-mabe-900">{result.categoryLabel}</span>
            <span className="rounded-full bg-teal-600 px-3 py-1 text-sm font-bold text-white">
              {result.fundingRatePct} % Förderquote
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onPdf}
        disabled={pdfBusy}
        className="inline-flex items-center gap-2 rounded-full bg-mabe-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-mabe-800 disabled:opacity-60"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
          <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
          <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
        </svg>
        {pdfBusy ? 'PDF wird erstellt…' : 'PDF-Nachweis herunterladen'}
      </button>

      <p className="max-w-md text-xs text-olive-500">
        Nutzen Sie diesen Nachweis auch für weitere Förderprogramme – die KMU-Einstufung ist die Grundlage für viele
        Zuschüsse von BAFA, KfW und Ländern.
      </p>
    </div>
  )
}
