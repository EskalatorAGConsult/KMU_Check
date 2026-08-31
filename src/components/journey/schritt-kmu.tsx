'use client'

import { useMemo } from 'react'

import type { KmuSchrittDaten } from '@/lib/journey/schemas'
import { evaluateKmu, formatEUR, formatNumber, type Holding } from '@/lib/kmu'
import { Checkbox, Feld, inputCls } from './ui'

type Beteiligung = KmuSchrittDaten['beteiligungen'][number]

const KEINE_BETEILIGUNGEN: Beteiligung[] = []

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return isFinite(n) && n >= 0 ? n : 0
}

/**
 * KMU-Schritt: eigene Kennzahlen + Verbund (Partner/verbundene Unternehmen)
 * mit Live-Auswertung ueber die gepruefte Engine aus src/lib/kmu.ts.
 */
export function SchrittKmu({
  daten,
  fehler,
  onChange,
}: {
  daten: Record<string, unknown>
  fehler: Record<string, string>
  onChange: (name: string, wert: unknown) => void
}) {
  const beteiligungen = (daten.beteiligungen as Beteiligung[] | undefined) ?? KEINE_BETEILIGUNGEN
  const geschaeftsjahr = (daten.geschaeftsjahr as number | string | undefined) ?? new Date().getFullYear() - 1

  const ergebnis = useMemo(() => {
    const holdings: Holding[] = beteiligungen
      .filter((b) => b?.name && num(b.anteil_pct) > 0)
      .map((b, i) => ({
        id: `b${i}`,
        name: b.name,
        sharePct: num(b.anteil_pct),
        employees: num(b.jae),
        turnover: num(b.umsatz),
        balanceSheet: num(b.bilanzsumme),
      }))
    return evaluateKmu({
      companyName: 'Antragsteller',
      employees: num(daten.jae),
      turnover: num(daten.umsatz),
      balanceSheet: num(daten.bilanzsumme),
      holdings,
    })
  }, [daten.jae, daten.umsatz, daten.bilanzsumme, beteiligungen])

  const setBeteiligung = (i: number, patch: Partial<Beteiligung>) => {
    const naechste = beteiligungen.map((b, j) => (j === i ? { ...b, ...patch } : b))
    onChange('beteiligungen', naechste)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Eigene Kennzahlen */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Feld label="Letztes abgeschlossenes Geschäftsjahr" pflicht fehler={fehler.geschaeftsjahr}
          hilfe="Bezugsjahr Ihrer Kennzahlen, z. B. 2025.">
          <input
            type="number"
            min={2000}
            max={2100}
            className={inputCls}
            value={String(geschaeftsjahr)}
            onChange={(e) => onChange('geschaeftsjahr', e.target.value)}
          />
        </Feld>
        <Feld label="Beschäftigte (Jahresarbeitseinheiten)" pflicht fehler={fehler.jae}
          hilfe="Vollzeitäquivalente. Teilzeit wird anteilig gezählt; Auszubildende und Elternzeit zählen nicht.">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            className={inputCls}
            value={String(daten.jae ?? '')}
            onChange={(e) => onChange('jae', e.target.value)}
          />
        </Feld>
        <Feld label="Jahresumsatz (€)" fehler={fehler.umsatz}
          hilfe="Es genügt, wenn Umsatz ODER Bilanzsumme innerhalb der KMU-Grenze liegt.">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            className={inputCls}
            value={String(daten.umsatz ?? '')}
            onChange={(e) => onChange('umsatz', e.target.value)}
          />
        </Feld>
        <Feld label="Bilanzsumme (€)" fehler={fehler.bilanzsumme}>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            className={inputCls}
            value={String(daten.bilanzsumme ?? '')}
            onChange={(e) => onChange('bilanzsumme', e.target.value)}
          />
        </Feld>
        <div className="sm:col-span-2">
          <Checkbox
            checked={(daten.abgeschlossen as boolean | undefined) ?? true}
            onChange={(v) => onChange('abgeschlossen', v)}
            label="Das Geschäftsjahr ist abgeschlossen (andernfalls zählt eine plausible Schätzung nach Treu und Glauben)."
          />
        </div>
      </div>

      {/* Verbund */}
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold text-mabe-900">Partner- und verbundene Unternehmen</h3>
          <p className="mt-1 text-sm/6 text-olive-600">
            Erfassen Sie Beteiligungen ab 25 % – in beide Richtungen (Anteile, die Sie halten, und Anteile, die an
            Ihnen gehalten werden). 25–50 % werden anteilig verrechnet, über 50 % zu 100 %.
          </p>
        </div>
        {fehler.beteiligungen && <p className="text-xs/5 font-medium text-red-700">{fehler.beteiligungen}</p>}
        {beteiligungen.map((b, i) => (
          <div key={i} className="rounded-2xl border border-olive-200 bg-olive-50/50 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <input
                className={inputCls}
                placeholder="Name des Unternehmens"
                value={b.name ?? ''}
                onChange={(e) => setBeteiligung(i, { name: e.target.value })}
              />
              <select
                className={inputCls}
                value={b.richtung ?? 'aufwaerts'}
                onChange={(e) => setBeteiligung(i, { richtung: e.target.value as Beteiligung['richtung'] })}
              >
                <option value="aufwaerts">hält Anteile an uns</option>
                <option value="abwaerts">wir halten Anteile daran</option>
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={25}
                  max={100}
                  className={inputCls}
                  placeholder="Anteil %"
                  value={String(b.anteil_pct ?? '')}
                  onChange={(e) => setBeteiligung(i, { anteil_pct: e.target.value as unknown as number })}
                />
                <button
                  type="button"
                  onClick={() => onChange('beteiligungen', beteiligungen.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  aria-label="Beteiligung entfernen"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="JAE (optional)"
                value={String(b.jae ?? '')}
                onChange={(e) => setBeteiligung(i, { jae: e.target.value as unknown as number })}
              />
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="Umsatz € (optional)"
                value={String(b.umsatz ?? '')}
                onChange={(e) => setBeteiligung(i, { umsatz: e.target.value as unknown as number })}
              />
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="Bilanzsumme € (optional)"
                value={String(b.bilanzsumme ?? '')}
                onChange={(e) => setBeteiligung(i, { bilanzsumme: e.target.value as unknown as number })}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange('beteiligungen', [...beteiligungen, { name: '', richtung: 'aufwaerts', anteil_pct: '' }])
          }
          className="self-start rounded-xl border border-dashed border-teal-600/50 px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50"
        >
          + Beteiligung hinzufügen
        </button>
      </div>

      {/* Live-Ergebnis */}
      <div className="rounded-2xl bg-mabe-900 p-6 text-white">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-olive-300 uppercase">Live-Auswertung (inkl. Verbund)</p>
            <p className="mt-1 text-xl font-semibold">
              {ergebnis.categoryLabel} · <span className="text-teal-300">{ergebnis.fundingRatePct} % Förderquote</span>
            </p>
          </div>
          <div className="text-right text-sm text-olive-300">
            <p>{formatNumber(ergebnis.consolidated.employees, 1)} JAE (fiktiv)</p>
            <p>
              {formatEUR(ergebnis.consolidated.turnover)} Umsatz · {formatEUR(ergebnis.consolidated.balanceSheet)} Bilanz
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs/5 text-olive-400">
          Unverbindliche Orientierung nach EU 2003/361/EG; verbindlich ist die Prüfung durch die Bewilligungsbehörde.
        </p>
      </div>
    </div>
  )
}
