'use client'

import { useMemo } from 'react'

import { holdingsFuerJahr } from '@/lib/journey/verbund-jahre'
import { evaluateKmu, formatEUR, formatNumber, type Holding, type KmuResult } from '@/lib/kmu'

type KmuDaten = Record<string, unknown>

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return isFinite(n) && n >= 0 ? n : 0
}

/**
 * KMU-Zusammenfassung am Ende der Journey (Vollmacht-Schritt): zeigt dem
 * Kunden noch einmal visuell, wohin seine Angaben fuehren – Einstufung,
 * Foerderquote, voraussichtliche Foerdersumme und vor allem verstaendlich
 * erklaert, welche Verbund-Groesse sich aus seinen Beteiligungen ergibt.
 * Rechnet mit derselben geprueften Engine (src/lib/kmu.ts) wie der KMU-Schritt.
 */
export function KmuZusammenfassung({
  kmuDaten,
  investSumme,
  firmenname,
}: {
  kmuDaten: KmuDaten | undefined
  investSumme: number | null
  firmenname?: string
}) {
  const ergebnis: KmuResult | null = useMemo(() => {
    if (!kmuDaten) return null
    const jahre = (kmuDaten.jahre as { geschaeftsjahr: number; jae?: unknown; umsatz?: unknown; bilanzsumme?: unknown }[] | undefined) ?? []
    if (jahre.length === 0) return null
    const juengstes = [...jahre].sort((a, b) => b.geschaeftsjahr - a.geschaeftsjahr)[0]
    const hatBeteiligungen = kmuDaten.hat_beteiligungen as boolean | undefined
    const wirksam = hatBeteiligungen === false ? [] : ((kmuDaten.beteiligungen as Record<string, unknown>[] | undefined) ?? [])
    // Verbund-Kennzahlen jahrgemischt fürs juengste Jahr (verbund-jahre.ts,
    // Skalar-Fallback fuer Drafts aus der Zeit vor der Jahres-Erfassung).
    const holdings: Holding[] = holdingsFuerJahr(wirksam, juengstes.geschaeftsjahr)
    return evaluateKmu({
      companyName: firmenname?.trim() || 'Ihr Unternehmen',
      employees: num(juengstes.jae),
      turnover: num(juengstes.umsatz),
      balanceSheet: num(juengstes.bilanzsumme),
      holdings,
    })
  }, [kmuDaten, firmenname])

  if (!ergebnis) return null

  // Juengstes abgeschlossenes Geschaeftsjahr – dynamisch, da die Auswertung
  // (und ggf. eine OpenRegister-Vorbefuellung) auch aeltere Jahre nutzt.
  const jahre = (kmuDaten?.jahre as { geschaeftsjahr: number }[] | undefined) ?? []
  const geschaeftsjahr = jahre.length ? Math.max(...jahre.map((j) => j.geschaeftsjahr)) : null

  const zuschuss = investSumme != null && investSumme > 0 ? (investSumme * ergebnis.fundingRatePct) / 100 : null
  // Verbund eingerechnet, wenn sich IRGENDEINE Kennzahl aendert – JAE ist bei
  // Beteiligungen optional, allein daran haengt die Aussage nicht.
  const mitVerbund =
    ergebnis.consolidated.employees !== ergebnis.own.employees ||
    ergebnis.consolidated.turnover !== ergebnis.own.turnover ||
    ergebnis.consolidated.balanceSheet !== ergebnis.own.balanceSheet

  return (
    <section
      aria-label="Zusammenfassung Ihrer KMU-Einstufung"
      className="overflow-hidden rounded-2xl border border-teal-600/25 bg-white shadow-sm"
    >
      <div className="border-b border-teal-600/15 bg-teal-50/60 px-5 py-4 sm:px-6">
        <h2 className="text-base font-semibold text-mabe-900">Ihre KMU-Einstufung – das reichen wir ein</h2>
        <p className="mt-0.5 text-xs/5 text-olive-600">
          Auf Basis Ihrer Angaben (Geschäftsjahr {geschaeftsjahr ?? '–'}, inkl. Verbundrechnung nach EU-Empfehlung 2003/361/EG).
        </p>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6">
        {/* Quote prominent */}
        <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:gap-1 sm:text-center">
          <p className="font-display text-4xl font-semibold text-teal-700 tabular-nums sm:text-5xl">
            {ergebnis.fundingRatePct}&nbsp;%
          </p>
          <p className="text-sm font-medium text-mabe-900">
            Förderquote
            <br />
            <span className="text-xs font-normal text-olive-500">{ergebnis.categoryLabel}</span>
          </p>
        </div>

        {/* Verbund-Groesse verstaendlich erklaert */}
        <div className="min-w-0 flex-1 text-sm/6 text-olive-700">
          <p>
            <strong className="text-mabe-900">
              Im Verbund hat Ihr Unternehmen die Größe von {formatNumber(ergebnis.consolidated.employees, 1)}{' '}
              Beschäftigten (JAE)
            </strong>{' '}
            bei einem Umsatz von {formatEUR(ergebnis.consolidated.turnover)} bzw. einer Bilanzsumme von{' '}
            {formatEUR(ergebnis.consolidated.balanceSheet)}.
          </p>
          <p className="mt-1.5">
            {mitVerbund
              ? `Darin sind Ihre angegebenen Partner- und verbundenen Unternehmen bereits anteilig eingerechnet (eigene Beschäftigte: ${formatNumber(ergebnis.own.employees, 1)} JAE). `
              : 'Sie haben keine zurechnungsfähigen Beteiligungen angegeben – es zählen allein Ihre eigenen Kennzahlen. '}
            Damit gilt Ihr Unternehmen als <strong className="text-mabe-900">{ergebnis.categoryLabel}</strong> und die
            Förderquote beträgt <strong className="text-teal-700">{ergebnis.fundingRatePct} %</strong>
            {zuschuss != null && (
              <>
                {' '}– bei Ihrer Investition also voraussichtlich{' '}
                <strong className="text-teal-700">{formatEUR(zuschuss)} Zuschuss</strong>
              </>
            )}
            .
          </p>
        </div>
      </div>

      <p className="border-t border-olive-100 bg-olive-50/50 px-5 py-2.5 text-xs/5 text-olive-500 sm:px-6">
        Unverbindliche Orientierung – die verbindliche Einstufung prüft die Bewilligungsbehörde (BAFA).
      </p>
    </section>
  )
}
