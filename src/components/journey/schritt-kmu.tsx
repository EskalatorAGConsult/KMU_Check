'use client'

import { useMemo } from 'react'

import type { KmuJahrDaten, KmuSchrittDaten } from '@/lib/journey/schemas'
import { holdingsFuerJahr, jahrKennzahl, jahreAufbauen } from '@/lib/journey/verbund-jahre'
import { analysiereVerbund, evaluateKmu, type Holding } from '@/lib/kmu'
import { SKALA } from '@/lib/slider-skala'
import type { VerbundErgebnis } from '@/lib/openregister/mapping'
import { VerbundBaum } from '@/components/kmu/verbund-baum'
import { KmuAbleitung } from './kmu-ableitung'
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
    // Live-Ampel bewertet das juengste Geschaeftsjahr (jahre[0], absteigend
    // sortiert) – Verbund-Kennzahlen jahrgemischt (BAFA fragt 2025 UND 2024
    // ab, auch fuer Partner-/verbundene Unternehmen).
    const juengstes = jahre[0] ?? standardJahre()[0]
    const holdings: Holding[] = holdingsFuerJahr(wirksam, juengstes.geschaeftsjahr)
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
   * Kennzahlwert EINER Beteiligung für EIN Geschäftsjahr setzen. Speichert den
   * rohen Eingabewert (String) – dasselbe Muster wie die eigenen Jahresfelder
   * (setJahr): Zod coerced serverseitig, die Anzeige laeuft ueber jahrKennzahl
   * (Komma-tolerant). Leere Eingabe = undefined (Zelle leererbar). Legacy-
   * Zeilen ohne jahre erben beim ersten Schreiben die Skalarwerte (jahreAufbauen).
   */
  const setBeteiligungJahr = (i: number, gj: number, feld: 'jae' | 'umsatz' | 'bilanzsumme', wert: string) => {
    const b = beteiligungen[i]
    if (!b) return
    const jahre = jahreAufbauen(b, BAFA_GESCHAEFTSJAHRE).map((j) =>
      j.geschaeftsjahr === gj ? { ...j, [feld]: wert.trim() === '' ? undefined : wert } : j,
    )
    setBeteiligung(i, { jahre })
  }

  /**
   * Handelsregister-Vorbefuellung uebernehmen: eigene Kennzahlen in die
   * Geschaeftsjahre schreiben, Register-Verbund ersetzt fruehere
   * Register-Eintraege (manuell erfasste Zeilen bleiben unangetastet).
   */
  const uebernehmeVerbund = (e: VerbundErgebnis) => {
    if (e.jahre.length > 0) {
      // Nach Geschaeftsjahr matchen, nicht nach Index: liefert das Register
      // nur ein Jahr (z. B. 2024), wuerde Index-Mapping dem zweiten Eintrag
      // dasselbe Jahr unterschieben -> doppelte React-Keys + doppelte
      // kmu_bewertungen-Zeile, und das Abfragejahr bliebe ungefuellt.
      onChange(
        'jahre',
        jahre.map((j) => {
          const gef = e.jahre.find((r) => r.geschaeftsjahr === j.geschaeftsjahr)
          return gef
            ? { ...j, abgeschlossen: true, jae: gef.jae, umsatz: gef.umsatz, bilanzsumme: gef.bilanzsumme }
            : j
        }),
      )
    }
    const manuell = beteiligungen.filter((b) => b?.quelle !== 'openregister' && b?.name)
    const ausRegister = e.beteiligungen.map((b) => ({
      name: b.name,
      richtung: b.richtung,
      anteil_pct: b.anteil_pct,
      // Register liefert beide BAFA-Jahre (Mapping 2 Jahre je Firma); fehlt
      // ein Jahr im Register, bleibt es leer und ist manuell ergänzbar.
      jahre: b.jahre,
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
      {/* SCHRITT 1 · Eigene Kennzahlen (BAFA fragt fest 2025 + 2024 ab) */}
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-olive-200 bg-olive-50/60 p-5">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-mabe-900 px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
            Schritt 1 von 3 · Ihre Zahlen
          </p>
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-mabe-900">
            Ihre Kennzahlen der Geschäftsjahre 2025 und 2024
            <span className="rounded-full bg-teal-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
              Ihr Unternehmen · Antragsteller
            </span>
            <Tooltip text="Das BAFA-Portal fragt fest die Kennzahlen der Geschäftsjahre 2025 und 2024 ab. Für Ihre Förderquote zählt das jüngste Jahr (2025) – das Jahr 2024 dokumentiert die Entwicklung Ihres Unternehmens." />
          </h3>
          <p className="mt-1 text-sm/6 text-olive-600">
            <strong className="text-mabe-900">Warum fragen wir das?</strong> Die Höhe Ihres Zuschusses hängt von der
            Unternehmensgröße ab – der Staat misst sie an Beschäftigten, Umsatz und Bilanzsumme. Sie finden alle
            Zahlen in Ihrem Jahresabschluss oder der BWA – im Zweifel kurz beim Steuerbüro nachfragen.
          </p>
          <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm/6 text-mabe-900 ring-1 ring-olive-200">
            <strong>Wichtig – beide Jahre, kompletter Verbund:</strong> Wir erfassen für die Geschäftsjahre{' '}
            <strong>2025 und 2024</strong> die <strong>jahreszeitäquivalenten Beschäftigten (JAE)</strong>, Umsatz und
            Bilanzsumme – und zwar nicht nur von Ihrem Unternehmen, sondern vom <strong>Gesamtverbund</strong> (Ihr
            Unternehmen plus alle Partner- und verbundenen Unternehmen aus dem nächsten Schritt). Ihre eigenen Zahlen
            tragen Sie hier ein, die Zahlen Ihrer Beteiligungen direkt danach.
          </p>
        </div>
        {fehler.jahre && <p className="text-xs/5 font-medium text-red-700">{fehler.jahre}</p>}
        {jahre.map((jahr, i) => (
          <fieldset
            key={jahr.geschaeftsjahr}
            className="rounded-2xl border border-olive-200 bg-white p-5"
          >
            <legend className="rounded-full bg-mabe-900 px-3 py-1 text-xs font-semibold text-white">
              Geschäftsjahr {jahr.geschaeftsjahr} · Ihr Unternehmen (Antragsteller)
              {i === 0 ? ' · jüngstes (zählt für Ihre Quote)' : ''}
            </legend>
            {i === 0 && (
              <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm/6 text-amber-900 ring-1 ring-amber-200">
                <strong>Zahlen für {jahr.geschaeftsjahr} noch nicht vorhanden?</strong> Kein Problem – wenn Ihr
                Jahresabschluss {jahr.geschaeftsjahr} noch nicht fertig ist (oder im Handelsregister noch keine
                Zahlen hinterlegt sind), tragen Sie eine <strong>plausible Schätzung nach Treu und Glauben</strong>{' '}
                ein (z. B. anhand der BWA oder des Vorjahres). Entfernen Sie dafür unten den Haken bei
                „Geschäftsjahr abgeschlossen“.
              </p>
            )}
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

      {/* SCHRITT 2 · Verbund (Verflechtungen sichtbar machen) */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-olive-200 bg-olive-50/60 p-5">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-mabe-900 px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
            Schritt 2 von 3 · Ihre Verflechtungen
          </p>
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-mabe-900">
            Partner- und verbundene Unternehmen
            <span className="rounded-full bg-mabe-100 px-2.5 py-0.5 text-[11px] font-bold text-mabe-800">
              ANDERE Unternehmen – nicht Ihr Unternehmen
            </span>
            <Tooltip text="Gehört Ihr Unternehmen zu einem Konzern oder halten Sie Anteile an anderen Firmen (oder umgekehrt)? Dann zählen deren Zahlen anteilig mit – das entscheidet mit über Ihre Förderquote. Unter 25 % Beteiligung brauchen Sie nichts anzugeben." />
          </h3>
          <p className="mt-1 text-sm/6 text-olive-600">
            <strong className="text-mabe-900">Warum fragen wir das?</strong> Die EU betrachtet nie nur Ihre Firma
            allein: Ab <strong className="text-mabe-900">25&nbsp;% Beteiligung</strong> – in beide Richtungen –
            fließen die Zahlen des <strong>anderen</strong> Unternehmens in Ihre Größe ein (25–50&nbsp;% anteilig,
            über 50&nbsp;% voll, auch über mehrere Stufen). Die Kennzahlen unten gehören deshalb{' '}
            <strong className="text-mabe-900">je Beteiligungsunternehmen</strong>, nicht zu Ihnen. Am Ende dieses
            Schritts sehen Sie Ihre Verflechtung als Grafik und die fertige Rechnung. Keine solchen Beteiligungen?
            Dann wählen Sie unten einfach „Nein“.
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
                {/* Kopf: Nummer + Live-Einstufung + Entfernen (Muster Landingpage-Tool).
                    Sticky: Beim Scrollen durch die Jahres-Kennzahlen bleibt sichtbar,
                    Wessen Zahlen hier gerade erfasst werden (nicht der Antragsteller). */}
                <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between gap-2 rounded-t-2xl bg-white px-4 py-3 ring-1 ring-olive-100 sm:-mx-5 sm:-mt-5 sm:px-5">
                  <span className="inline-flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-mabe-900">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mabe-900 text-xs text-white">
                      {i + 1}
                    </span>
                    Beteiligtes Unternehmen
                    <span className="text-[11px] font-bold text-mabe-700">(nicht Ihr Unternehmen)</span>
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
                  {/* Skala positionsgenau zur Schiene (Vertrag: slider-skala.ts):
                      Wert 50 liegt bei 33,3 % der Schienenlänge, nicht in der
                      Mitte – sonst tauscht die Mitte 62,5 % als „50 %" vor.
                      Darunter die EU-Zonen mit Kipppunkt > 50 %. */}
                  <div className="relative mt-1.5 h-4 text-[11px] text-olive-500 tabular-nums" aria-hidden>
                    <span className="absolute left-0">25 %</span>
                    <span className="absolute" style={{ left: `${SKALA.kipppunkt50}%`, transform: 'translateX(-50%)' }}>
                      50 %
                    </span>
                    <span className="absolute right-0">100 %</span>
                  </div>
                  <div className="relative h-2" aria-hidden>
                    <span
                      className="absolute top-0 h-2 w-0.5 rounded bg-mabe-400"
                      style={{ left: `${SKALA.kipppunkt50}%` }}
                      title="EU-Kipppunkt: über 50 % = verbundenes Unternehmen (volle Zurechnung)"
                    />
                  </div>
                  <div className="relative h-4 text-[10px]" aria-hidden>
                    <span
                      className="absolute font-medium text-teal-700"
                      style={{ left: `${SKALA.zonePartner}%`, transform: 'translateX(-50%)' }}
                    >
                      anteilig (Partner)
                    </span>
                    <span
                      className="absolute font-medium text-mabe-800"
                      style={{ left: `${SKALA.zoneVerbunden}%`, transform: 'translateX(-50%)' }}
                    >
                      voll (verbunden)
                    </span>
                  </div>
                </div>

                {/* Kennzahlen je BAFA-Geschäftsjahr (2025 UND 2024 – das Portal
                    fragt beide ab, auch für Partner-/verbundene Unternehmen). */}
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-olive-600">
                    Kennzahlen je Geschäftsjahr (2025 und 2024) dieses Unternehmens{' '}
                    <span className="font-normal text-olive-400">
                      – jahreszeitäquivalente Beschäftigte (JAE), Umsatz, Bilanzsumme
                    </span>
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[30rem] text-sm">
                      <thead>
                        <tr className="border-b border-olive-200 text-left text-xs text-olive-500">
                          <th className="py-1.5 pr-3 font-semibold">Geschäftsjahr</th>
                          <th className="py-1.5 pr-3 font-semibold">Beschäftigte (JAE)</th>
                          <th className="py-1.5 pr-3 font-semibold">Umsatz (€)</th>
                          <th className="py-1.5 font-semibold">Bilanzsumme (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-olive-100">
                        {BAFA_GESCHAEFTSJAHRE.map((gj) => (
                          <tr key={gj}>
                            <td className="py-2 pr-3 font-medium whitespace-nowrap text-mabe-900 tabular-nums">
                              {gj}
                              {gj === (jahre[0]?.geschaeftsjahr ?? BAFA_GESCHAEFTSJAHRE[0]) && (
                                <span className="ml-1.5 text-[10px] font-semibold text-teal-700">zählt für Ihre Quote</span>
                              )}
                            </td>
                            {(
                              [
                                ['jae', 'Beschäftigte (JAE)'],
                                ['umsatz', 'Umsatz (€)'],
                                ['bilanzsumme', 'Bilanzsumme (€)'],
                              ] as const
                            ).map(([feldname, label]) => (
                              <td key={feldname} className="py-1.5 pr-3 last:pr-0">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  className={`${inputCls} tabular-nums`}
                                  placeholder="0"
                                  aria-label={`${b.name || 'Beteiligung'}: ${label} ${gj}`}
                                  value={String(jahrKennzahl(b, gj, feldname) ?? '')}
                                  onChange={(e) => setBeteiligungJahr(i, gj, feldname, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1.5 text-[11px]/4 text-olive-500">
                    Zahlen fehlen für ein Jahr (z. B. im Handelsregister noch nicht veröffentlicht)? Dann wie bei Ihren
                    eigenen Zahlen eine plausible Schätzung eintragen oder leer lassen.
                  </p>
                  {(() => {
                    // Audit 02.09.2026: Bleibt das quote-relevante Jahr (juengstes)
                    // dieser Beteiligung leer, rechnet die Verbundgroesse mit 0 –
                    // die Quote faehle zu hoch. Transparenter Hinweis statt
                    // stiller Schaetzung (keine Werte-Erfindung, s. verbund-jahre.ts).
                    const gjQuote = jahre[0]?.geschaeftsjahr ?? BAFA_GESCHAEFTSJAHRE[0]
                    const felder = ['jae', 'umsatz', 'bilanzsumme'] as const
                    const quoteLeer = felder.every((f) => jahrKennzahl(b, gjQuote, f) == null)
                    const vorjahrVorhanden = BAFA_GESCHAEFTSJAHRE.some(
                      (gj) => gj !== gjQuote && felder.some((f) => jahrKennzahl(b, gj, f) != null),
                    )
                    return quoteLeer && vorjahrVorhanden ? (
                      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs/5 font-medium text-amber-900 ring-1 ring-amber-200">
                        Achtung: Für Ihre Förderquote zählt {gjQuote} – dieses Jahr ist für „{b.name || 'dieses Unternehmen'}“
                        noch leer. Bitte {gjQuote}er Werte eintragen (ggf. Schätzung anhand des Vorjahres), sonst fällt
                        das Unternehmen bei der Quote-Rechnung zu niedrig aus.
                      </p>
                    ) : null
                  })()}
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

      {/* Schritt 3: transparente Herleitung + Ampel */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <span className="inline-flex items-center rounded-full bg-mabe-900 px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase">
            Schritt 3 von 3 · Ihr Ergebnis
          </span>
          <h2 className="mt-3 text-lg font-semibold text-slate-900">Ihre Einstufung – transparent hergeleitet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Unten sehen Sie, wie sich Ihre Verbundgröße zusammensetzt und wo Sie damit auf der EU-Skala landen. Sie
            müssen nichts weiter eingeben – die Auswertung aktualisiert sich live mit jeder Angabe oben.
          </p>
        </div>
        <KmuAbleitung ergebnis={ergebnis} />
      </div>

      {/* Live-Ergebnis: Ampel mit Foerderquote + Foerdersumme */}
      <KmuAmpel ergebnis={ergebnis} investSumme={investSumme} />
    </div>
  )
}
