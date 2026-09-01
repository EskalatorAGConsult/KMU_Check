'use client'

import { useMemo } from 'react'

import type { KmuJahrDaten, KmuSchrittDaten } from '@/lib/journey/schemas'
import { analysiereVerbund, evaluateKmu, type Holding } from '@/lib/kmu'
import type { VerbundErgebnis } from '@/lib/openregister/mapping'
import { VerbundBaum } from '@/components/kmu/verbund-baum'
import { KmuAmpel } from './ampel'
import { Tooltip } from './tooltip'
import { Checkbox, Feld, inputCls } from './ui'
import { VerbundSuche } from './verbund-suche'

type Beteiligung = KmuSchrittDaten['beteiligungen'][number]
type KmuJahrEingabe = Partial<KmuJahrDaten> & { geschaeftsjahr: number }

const KEINE_BETEILIGUNGEN: Beteiligung[] = []

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return isFinite(n) && n >= 0 ? n : 0
}

/**
 * BAFA-Vorgabe EEW Modul 3: Das Portal fragt fest die Geschaeftsjahre
 * 2025 und 2024 ab (juengstes Jahr zaehlt fuer die Foerderquote).
 * Bewusst NICHT dynamisch kalenderbasiert – die abgefragten Jahre richten
 * sich nach dem BAFA-Formular, nicht nach dem aktuellen Datum.
 */
export const BAFA_GESCHAEFTSJAHRE = [2025, 2024] as const

function standardJahre(): KmuJahrEingabe[] {
  return BAFA_GESCHAEFTSJAHRE.map((gj) => ({ geschaeftsjahr: gj, abgeschlossen: true }))
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
  token,
  registerId,
  firmenname,
  onChange,
}: {
  daten: Record<string, unknown>
  fehler: Record<string, string>
  investSumme: number | null
  token: string
  /** Firmenwahl aus dem Schritt „Ihr Unternehmen" (OpenRegister company_id). */
  registerId?: string
  /** Firmenname aus dem Schritt „Ihr Unternehmen" (Wurzel der Verbund-Anzeige). */
  firmenname?: string
  onChange: (name: string, wert: unknown) => void
}) {
  const wurzelName = firmenname?.trim() || 'Ihr Unternehmen'
  const beteiligungen = (daten.beteiligungen as Beteiligung[] | undefined) ?? KEINE_BETEILIGUNGEN
  /**
   * Leitfrage „Beteiligungsverhältnisse vorhanden?" – explizite Antwort hat
   * Vorrang; sind (vor befüllte) Zeilen da, gilt implizit „ja". undefined =
   * noch nicht beantwortet -> Liste wird gezeigt (Prefill-Fall).
   */
  const hatBeteiligungen =
    (daten.hat_beteiligungen as boolean | undefined) ?? (beteiligungen.length > 0 ? true : undefined)
  const jahreRoh = daten.jahre as KmuJahrEingabe[] | undefined
  const jahre = useMemo(
    () => (jahreRoh ?? standardJahre()).slice().sort((a, b) => b.geschaeftsjahr - a.geschaeftsjahr),
    [jahreRoh],
  )

  const setJahr = (i: number, patch: Partial<KmuJahrEingabe>) => {
    onChange('jahre', jahre.map((j, k) => (k === i ? { ...j, ...patch } : j)))
  }

  const setzeHatBeteiligungen = (v: boolean) => {
    onChange('hat_beteiligungen', v)
    if (!v) onChange('beteiligungen', [])
  }

  const { ergebnis, zeilen, holdings } = useMemo(() => {
    // Datenkonsistenz: „keine Beteiligungen" -> Ampel rechnet mit leerem Verbund
    const wirksam = hatBeteiligungen === false ? KEINE_BETEILIGUNGEN : beteiligungen
    const holdings: Holding[] = wirksam
      .filter((b) => b?.name && num(b.anteil_pct) > 0)
      .map((b, i) => ({
        id: `b${i}`,
        name: b.name,
        sharePct: num(b.anteil_pct),
        employees: num(b.jae),
        turnover: num(b.umsatz),
        balanceSheet: num(b.bilanzsumme),
        bezug: b.bezug || undefined,
      }))
    // Live-Ampel bewertet das juengste Geschaeftsjahr (jahre[0], absteigend sortiert)
    const juengstes = jahre[0] ?? standardJahre()[0]
    return {
      ergebnis: evaluateKmu({
        companyName: wurzelName,
        employees: num(juengstes.jae),
        turnover: num(juengstes.umsatz),
        balanceSheet: num(juengstes.bilanzsumme),
        holdings,
      }),
      zeilen: analysiereVerbund(wurzelName, holdings),
      holdings,
    }
  }, [jahre, beteiligungen, hatBeteiligungen, wurzelName])

  /** Live-Einstufung einer Zeile aus der Kettenanalyse (Name ist eindeutig). */
  const zeileZu = (name: string | undefined) => zeilen.find((z) => z.name === (name ?? '').trim())

  const setBeteiligung = (i: number, patch: Partial<Beteiligung>) => {
    const naechste = beteiligungen.map((b, j) => (j === i ? { ...b, ...patch } : b))
    onChange('beteiligungen', naechste)
  }

  /**
   * Handelsregister-Vorbefuellung uebernehmen: eigene Kennzahlen in die
   * Geschaeftsjahre schreiben, Register-Verbund ersetzt fruehere
   * Register-Eintraege (manuell erfasste Zeilen bleiben unangetastet).
   */
  const uebernehmeVerbund = (e: VerbundErgebnis) => {
    if (e.jahre.length > 0) {
      onChange(
        'jahre',
        jahre.map((j, i) => {
          const gef = e.jahre[i]
          return gef
            ? { ...j, geschaeftsjahr: gef.geschaeftsjahr, abgeschlossen: true, jae: gef.jae, umsatz: gef.umsatz, bilanzsumme: gef.bilanzsumme }
            : j
        }),
      )
    }
    const manuell = beteiligungen.filter((b) => b?.quelle !== 'openregister' && b?.name)
    const ausRegister = e.beteiligungen.map((b) => ({
      name: b.name,
      richtung: b.richtung,
      anteil_pct: b.anteil_pct,
      jae: b.jae,
      umsatz: b.umsatz,
      bilanzsumme: b.bilanzsumme,
      quelle: 'openregister' as const,
      stufe: b.stufe,
      pfad: b.pfad,
      // Stufe 1 haengt per Definition am Antragsteller (kein Bezug noetig);
      // erst Folgestufen verweisen auf ein Zwischenunternehmen der Kette.
      bezug: b.stufe > 1 ? b.bezug : undefined,
    }))
    onChange('beteiligungen', [...manuell, ...ausRegister])
    // Register-Befund beantwortet die Leitfrage automatisch (editierbar)
    onChange('hat_beteiligungen', e.beteiligungen.length > 0)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Schnellstart: Handelsregister-Vorbefuellung (best effort, optional) */}
      <VerbundSuche token={token} initialRegisterId={registerId} onUebernehmen={uebernehmeVerbund} />
      {/* Eigene Kennzahlen: BAFA fragt fest die Geschaeftsjahre 2025 + 2024 ab */}
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-olive-200 bg-olive-50/60 p-5">
          <h3 className="flex items-center text-base font-semibold text-mabe-900">
            Ihre Kennzahlen der Geschäftsjahre 2025 und 2024
            <Tooltip text="Das BAFA-Portal fragt fest die Kennzahlen der Geschäftsjahre 2025 und 2024 ab. Für Ihre Förderquote zählt das jüngste Jahr (2025) – das Jahr 2024 dokumentiert die Entwicklung Ihres Unternehmens." />
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
            voll. Keine solchen Beteiligungen? Dann wählen Sie unten einfach „Nein“.
          </p>
        </div>
        {fehler.beteiligungen && <p className="text-xs/5 font-medium text-red-700">{fehler.beteiligungen}</p>}

        {/* Leitfrage – gleiches Muster wie im Landingpage-KMU-Tool */}
        <div className="rounded-2xl border border-olive-200 bg-white p-5">
          <p className="text-sm font-semibold text-mabe-900">
            Steht Ihr Unternehmen in Beteiligungsverhältnissen von mindestens 25 %?
          </p>
          <p className="mt-1 text-xs/5 text-olive-500">
            Anteile, die andere Firmen an Ihrem Unternehmen halten – oder die Sie an anderen Firmen halten.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm" role="group" aria-label="Beteiligungsverhältnisse vorhanden?">
            {([true, false] as const).map((v) => (
              <button
                key={v ? 'ja' : 'nein'}
                type="button"
                onClick={() => setzeHatBeteiligungen(v)}
                aria-pressed={hatBeteiligungen === v}
                className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 ${
                  hatBeteiligungen === v
                    ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                    : 'border-olive-300 bg-white text-mabe-900 hover:border-teal-600 hover:bg-teal-50/60'
                }`}
              >
                {v ? 'Ja' : 'Nein'}
              </button>
            ))}
          </div>
        </div>

        {hatBeteiligungen === false && (
          <p className="rounded-xl border border-olive-200 bg-white px-4 py-3 text-sm text-olive-700" role="status">
            Verstanden – Ihr Unternehmen wird als eigenständig bewertet. Die Handelsregister-Abfrage oben können
            Sie trotzdem zur Kontrolle nutzen.
          </p>
        )}

        {hatBeteiligungen !== false &&
          beteiligungen.map((b, i) => {
            const pct = num(b.anteil_pct)
            // Live-Einstufung aus der EU-Kettenanalyse (beruecksichtigt Folgestufen)
            const zeile = zeileZu(b.name)
            const verbunden = zeile ? zeile.art === 'verbunden' : pct > 50
            const nichtRelevant = zeile?.art === 'ignoriert'
            return (
              <div key={i} className="rounded-2xl border border-olive-200 bg-olive-50/50 p-4 sm:p-5">
                {/* Kopf: Nummer + Live-Einstufung + Entfernen (Muster Landingpage-Tool) */}
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-mabe-900">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mabe-900 text-xs text-white">
                      {i + 1}
                    </span>
                    Beteiligung
                    {pct >= 25 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          nichtRelevant
                            ? 'bg-olive-100 text-olive-500'
                            : verbunden
                              ? 'bg-mabe-100 text-mabe-800'
                              : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {nichtRelevant
                          ? 'Nicht verrechnungspflichtig'
                          : verbunden
                            ? 'Verbunden · zählt zu 100 %'
                            : `Partner · zählt zu ${Math.round(zeile?.effektivPct ?? pct)} %`}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange('beteiligungen', beteiligungen.filter((_, j) => j !== i))}
                    className="shrink-0 rounded-full p-1.5 text-olive-500 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label={`Beteiligung ${b.name || i + 1} entfernen`}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443A28.97 28.97 0 0 0 2.5 4.5a.75.75 0 0 0 0 1.5h.227l.706 11.31A2.75 2.75 0 0 0 6.178 19h7.644a2.75 2.75 0 0 0 2.745-2.69L17.273 6H17.5a.75.75 0 0 0 0-1.5 28.97 28.97 0 0 0-3.5-.307V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                {b.quelle === 'openregister' && (
                  <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-600/20">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Aus dem Handelsregister übernommen – bitte prüfen
                  </p>
                )}
                {b.pfad && (b.stufe ?? 1) > 1 && (
                  <p className="mb-3 text-xs/5 break-words text-olive-500">
                    Stufe {b.stufe} der Beteiligungskette · {b.pfad}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-olive-600">Name des Unternehmens</span>
                    <input
                      className={inputCls}
                      placeholder="z. B. Tochter GmbH"
                      value={b.name ?? ''}
                      onChange={(e) => setBeteiligung(i, { name: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-olive-600">Beziehung</span>
                    <select
                      className={inputCls}
                      value={b.richtung ?? 'aufwaerts'}
                      onChange={(e) => setBeteiligung(i, { richtung: e.target.value as Beteiligung['richtung'] })}
                    >
                      <option value="aufwaerts">Diese Firma hält Anteile an uns</option>
                      <option value="abwaerts">Wir halten Anteile an dieser Firma</option>
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-olive-600">
                      Die Beteiligung besteht an …
                      <Tooltip text="Standard: an Ihrem Unternehmen (1. Stufe). Liegt die Beteiligung eine Stufe darüber oder darunter – z. B. hält eine Holding Anteile an Ihrer Muttergesellschaft – wählen Sie hier das Zwischenunternehmen. So werden auch Folgeketten EU-korrekt verrechnet." />
                    </span>
                    <select
                      className={inputCls}
                      value={b.bezug ?? ''}
                      onChange={(e) => setBeteiligung(i, { bezug: e.target.value || undefined })}
                    >
                      <option value="">{wurzelName} (Ihr Unternehmen)</option>
                      {beteiligungen
                        .map((andere, j) => ({ name: (andere?.name ?? '').trim(), j }))
                        .filter((andere) => andere.j !== i && andere.name !== '')
                        .map((andere) => (
                          <option key={andere.j} value={andere.name}>
                            {andere.name}
                          </option>
                        ))}
                    </select>
                    {b.bezug && (
                      <span className="mt-1 block text-[11px]/4 text-olive-500">
                        Die Quote bezieht sich dann auf „{b.bezug}“ (Folgestufe der Beteiligungskette).
                      </span>
                    )}
                  </label>
                </div>

                {/* Beteiligungsquote als Slider mit Live-Prozent (Muster Landingpage-Tool) */}
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <label htmlFor={`b-anteil-${i}`} className="font-semibold text-mabe-900">
                      Beteiligungsquote
                    </label>
                    <span className="font-bold text-mabe-900 tabular-nums">
                      {pct > 0 ? `${Math.round(pct)} %` : '–'}
                    </span>
                  </div>
                  <input
                    id={`b-anteil-${i}`}
                    type="range"
                    min={25}
                    max={100}
                    step={1}
                    value={Math.min(100, Math.max(25, pct || 25))}
                    onChange={(e) => setBeteiligung(i, { anteil_pct: Number(e.target.value) })}
                    className="w-full accent-teal-600"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-olive-500">
                    <span>25 % (anteilig)</span>
                    <span>50 %</span>
                    <span>100 % (voll)</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(
                    [
                      ['jae', 'Beschäftigte (JAE)'],
                      ['umsatz', 'Umsatz (€)'],
                      ['bilanzsumme', 'Bilanzsumme (€)'],
                    ] as const
                  ).map(([feldname, label]) => (
                    <label key={feldname} className="block">
                      <span className="mb-1 block text-xs font-semibold text-olive-600">
                        {label} <span className="font-normal text-olive-400">(optional)</span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="0"
                        value={String(b[feldname] ?? '')}
                        onChange={(e) => setBeteiligung(i, { [feldname]: e.target.value as unknown as number })}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )
          })}

        {hatBeteiligungen !== false && (
          <button
            type="button"
            onClick={() => {
              onChange('hat_beteiligungen', true)
              onChange('beteiligungen', [...beteiligungen, { name: '', richtung: 'aufwaerts', anteil_pct: 50 }])
            }}
            className="self-start rounded-xl border border-dashed border-teal-600/50 px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50"
          >
            + Beteiligung hinzufügen
          </button>
        )}

        {/* Visualisierung der Kette (inkl. Folgestufen und Verrechnungsquoten) */}
        {hatBeteiligungen !== false && holdings.length > 0 && (
          <VerbundBaum firmenname={wurzelName} holdings={holdings} />
        )}
      </div>

      {/* Live-Ergebnis: Ampel mit Foerderquote + Foerdersumme */}
      <KmuAmpel ergebnis={ergebnis} investSumme={investSumme} />
    </div>
  )
}
