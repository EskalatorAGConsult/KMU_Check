'use client'

import { useMemo } from 'react'

import type { KmuJahrDaten, KmuSchrittDaten } from '@/lib/journey/schemas'
import { evaluateKmu, type Holding } from '@/lib/kmu'
import { KmuAmpel } from './ampel'
import { Tooltip } from './tooltip'
import { Checkbox, Feld, inputCls } from './ui'

type Beteiligung = KmuSchrittDaten['beteiligungen'][number]
type KmuJahrEingabe = Partial<KmuJahrDaten> & { geschaeftsjahr: number }

const KEINE_BETEILIGUNGEN: Beteiligung[] = []

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return isFinite(n) && n >= 0 ? n : 0
}

/** Die letzten zwei abgeschlossenen Geschaeftsjahre (dynamisch, kalenderbasiert). */
function standardJahre(): KmuJahrEingabe[] {
  const aktuell = new Date().getFullYear()
  return [aktuell - 1, aktuell - 2].map((gj) => ({ geschaeftsjahr: gj, abgeschlossen: true }))
}

/**
 * KMU-Schritt: eigene Kennzahlen der letzten zwei abgeschlossenen
 * Geschaeftsjahre + Verbund (Partner/verbundene Unternehmen) mit
 * Live-Auswertung ueber die gepruefte Engine aus src/lib/kmu.ts.
 */
export function SchrittKmu({
  daten,
  fehler,
  investSumme,
  onChange,
}: {
  daten: Record<string, unknown>
  fehler: Record<string, string>
  investSumme: number | null
  onChange: (name: string, wert: unknown) => void
}) {
  const beteiligungen = (daten.beteiligungen as Beteiligung[] | undefined) ?? KEINE_BETEILIGUNGEN
  const jahreRoh = daten.jahre as KmuJahrEingabe[] | undefined
  const jahre = useMemo(
    () => (jahreRoh ?? standardJahre()).slice().sort((a, b) => b.geschaeftsjahr - a.geschaeftsjahr),
    [jahreRoh],
  )

  const setJahr = (i: number, patch: Partial<KmuJahrEingabe>) => {
    onChange('jahre', jahre.map((j, k) => (k === i ? { ...j, ...patch } : j)))
  }

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
    // Live-Ampel bewertet das juengste Geschaeftsjahr (jahre[0], absteigend sortiert)
    const juengstes = jahre[0] ?? standardJahre()[0]
    return evaluateKmu({
      companyName: 'Antragsteller',
      employees: num(juengstes.jae),
      turnover: num(juengstes.umsatz),
      balanceSheet: num(juengstes.bilanzsumme),
      holdings,
    })
  }, [jahre, beteiligungen])

  const setBeteiligung = (i: number, patch: Partial<Beteiligung>) => {
    const naechste = beteiligungen.map((b, j) => (j === i ? { ...b, ...patch } : b))
    onChange('beteiligungen', naechste)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Eigene Kennzahlen: letzte zwei abgeschlossene Geschaeftsjahre (dynamisch) */}
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-olive-200 bg-olive-50/60 p-5">
          <h3 className="flex items-center text-base font-semibold text-mabe-900">
            Ihre Kennzahlen der letzten zwei Geschäftsjahre
            <Tooltip text="Das BAFA fragt die Kennzahlen der letzten zwei abgeschlossenen Geschäftsjahre ab. Für Ihre Förderquote zählt das jüngste Jahr – das zweite Jahr dokumentiert die Entwicklung Ihres Unternehmens." />
          </h3>
          <p className="mt-1 text-sm/6 text-olive-600">
            Sie finden alle Zahlen in Ihrem Jahresabschluss oder der BWA – im Zweifel kurz beim Steuerbüro
            nachfragen.
          </p>
        </div>
        {fehler.jahre && <p className="text-xs/5 font-medium text-red-700">{fehler.jahre}</p>}
        {jahre.map((jahr, i) => (
          <fieldset
            key={jahr.geschaeftsjahr}
            className="rounded-2xl border border-olive-200 bg-white p-5"
          >
            <legend className="rounded-full bg-mabe-900 px-3 py-1 text-xs font-semibold text-white">
              Geschäftsjahr {jahr.geschaeftsjahr}
              {i === 0 ? ' · jüngstes (zählt für Ihre Quote)' : ''}
            </legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Feld label="Beschäftigte (Jahresarbeitseinheiten)" pflicht={i === 0}
                hilfe={i === 0 ? 'Vollzeitäquivalente. Teilzeit anteilig; Azubis/Elternzeit zählen nicht.' : undefined}
                tooltip={i === 0 ? 'Nicht die Kopfzahl, sondern Vollzeitäquivalente: Zwei Halbtagskräfte zählen als 1 Beschäftigte/r. Diese Zahl ist für die Einstufung verbindlich.' : undefined}>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  className={inputCls}
                  value={String(jahr.jae ?? '')}
                  onChange={(e) => setJahr(i, { jae: e.target.value as unknown as number })}
                />
              </Feld>
              <Feld label="Jahresumsatz (€)"
                hilfe={i === 0 ? 'Es genügt Umsatz ODER Bilanzsumme innerhalb der Grenze.' : undefined}
                tooltip={i === 0 ? 'Jahresumsatz ohne Mehrwertsteuer (Jahresabschluss/BWA). Überschreiten Sie eine Umsatzgrenze, kann die Bilanzsumme die Einstufung trotzdem retten – eines von beiden genügt.' : undefined}>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  className={inputCls}
                  value={String(jahr.umsatz ?? '')}
                  onChange={(e) => setJahr(i, { umsatz: e.target.value as unknown as number })}
                />
              </Feld>
              <Feld label="Bilanzsumme (€)"
                tooltip={i === 0 ? 'Summe aller Vermögenswerte laut Bilanz (unterste Zeile). Steht im Jahresabschluss – oder kurz beim Steuerbüro erfragen.' : undefined}>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  className={inputCls}
                  value={String(jahr.bilanzsumme ?? '')}
                  onChange={(e) => setJahr(i, { bilanzsumme: e.target.value as unknown as number })}
                />
              </Feld>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <Checkbox
                checked={jahr.abgeschlossen ?? true}
                onChange={(v) => setJahr(i, { abgeschlossen: v })}
                label="Geschäftsjahr abgeschlossen (sonst plausible Schätzung nach Treu und Glauben)."
              />
              <label className="flex items-center gap-2 text-xs text-olive-600">
                Abweichendes Jahr:
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  className="w-24 rounded-lg border border-olive-300 px-2 py-1.5 text-sm text-mabe-900 focus:border-teal-600 focus:outline-none"
                  value={String(jahr.geschaeftsjahr)}
                  onChange={(e) =>
                    setJahr(i, { geschaeftsjahr: Number(e.target.value) || jahr.geschaeftsjahr })
                  }
                  aria-label={`Geschäftsjahr ${i + 1} anpassen`}
                />
              </label>
            </div>
          </fieldset>
        ))}
      </div>

      {/* Verbund */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-olive-200 bg-olive-50/60 p-5">
          <h3 className="flex items-center text-base font-semibold text-mabe-900">
            Partner- und verbundene Unternehmen
            <Tooltip text="Gehört Ihr Unternehmen zu einem Konzern oder halten Sie Anteile an anderen Firmen (oder umgekehrt)? Dann zählen deren Zahlen anteilig mit – das entscheidet mit über Ihre Förderquote. Unter 25 % Beteiligung brauchen Sie nichts anzugeben." />
          </h3>
          <p className="mt-1 text-sm/6 text-olive-600">
            <strong className="text-mabe-900">Kurz gesagt:</strong> Nur wenn eine Beteiligung von{' '}
            <strong className="text-mabe-900">mindestens 25&nbsp;%</strong> besteht, müssen Sie hier etwas eintragen –
            in beide Richtungen (Anteile, die Sie halten, und Anteile, die andere an Ihnen halten). Beträgt die
            Beteiligung 25–50&nbsp;%, zählen die Zahlen des anderen Unternehmens anteilig; über 50&nbsp;% zählen sie
            voll. Keine solchen Beteiligungen? Dann überspringen Sie diesen Abschnitt einfach.
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

      {/* Live-Ergebnis: Ampel mit Foerderquote + Foerdersumme */}
      <KmuAmpel ergebnis={ergebnis} investSumme={investSumme} />
    </div>
  )
}
