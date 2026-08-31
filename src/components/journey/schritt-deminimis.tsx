'use client'

import { useMemo } from 'react'

import type { DeminimisSchrittDaten } from '@/lib/journey/schemas'
import { formatEUR } from '@/lib/kmu'
import { Checkbox, inputCls } from './ui'

type Beihilfe = DeminimisSchrittDaten['beihilfen'][number]

const HOECHSTBETRAG = 300_000

const KEINE_BEIHILFEN: Beihilfe[] = []

/**
 * De-minimis-Schritt (VO (EU) 2023/2831): Beihilfen der letzten 3 Jahre,
 * Live-Summe gegen den Hoechstbetrag von 300.000 €, gesetzliche Bestaetigungen.
 */
export function SchrittDeminimis({
  daten,
  fehler,
  onChange,
}: {
  daten: Record<string, unknown>
  fehler: Record<string, string>
  onChange: (name: string, wert: unknown) => void
}) {
  const beihilfen = (daten.beihilfen as Beihilfe[] | undefined) ?? KEINE_BEIHILFEN

  const summe = useMemo(
    () => beihilfen.reduce((s, b) => s + (Number(b?.betrag) || 0), 0),
    [beihilfen],
  )
  const ueberschritten = summe > HOECHSTBETRAG

  const setBeihilfe = (i: number, patch: Partial<Beihilfe>) =>
    onChange('beihilfen', beihilfen.map((b, j) => (j === i ? { ...b, ...patch } : b)))

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-olive-200 bg-olive-50/60 p-5 text-sm/6 text-olive-700">
        Geben Sie alle <strong>De-minimis-Beihilfen</strong> an, die Ihr Unternehmen bzw. Ihr Unternehmensverbund in
        den <strong>letzten drei Jahren</strong> erhalten oder beantragt hat. Sie erkennen diese an der
        „De-minimis-Bescheinigung“ des Zuwendungsgebers. Der Höchstbetrag beträgt{' '}
        <strong>{formatEUR(HOECHSTBETRAG)}</strong> in drei Jahren.
      </div>

      {fehler.beihilfen && <p className="text-xs/5 font-medium text-red-700">{fehler.beihilfen}</p>}

      {beihilfen.length === 0 && (
        <div className="flex gap-3 rounded-2xl border border-dashed border-olive-300 bg-white p-5">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden>
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm/6 text-olive-700">
            <strong className="text-mabe-900">Keine Förderungen erhalten?</strong> Dann ist hier nichts weiter zu tun –
            lassen Sie die Liste einfach leer und bestätigen Sie unten. Die meisten Unternehmen haben keine oder nur
            eine De-minimis-Beihilfe.
          </p>
        </div>
      )}

      {beihilfen.map((b, i) => (
        <div key={i} className="rounded-2xl border border-olive-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              className={inputCls}
              placeholder="Beihilfegeber (z. B. BAFA, Land, Kommune)"
              value={b.beihilfegeber ?? ''}
              onChange={(e) => setBeihilfe(i, { beihilfegeber: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="Aktenzeichen / Kontonummer (optional)"
              value={b.aktenzeichen ?? ''}
              onChange={(e) => setBeihilfe(i, { aktenzeichen: e.target.value })}
            />
            <label className="flex flex-col gap-1 text-xs font-medium text-olive-600">
              Datum der Bewilligung / Zusage
              <input
                type="date"
                className={inputCls}
                value={b.bewilligt_am ?? ''}
                onChange={(e) => setBeihilfe(i, { bewilligt_am: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-olive-600">
              Beihilfewert (€)
              <input
                type="number"
                min={0}
                className={inputCls}
                value={String(b.betrag ?? '')}
                onChange={(e) => setBeihilfe(i, { betrag: e.target.value as unknown as number })}
              />
            </label>
            <select
              className={inputCls}
              value={b.form ?? 'zuschuss'}
              onChange={(e) => setBeihilfe(i, { form: e.target.value as Beihilfe['form'] })}
            >
              <option value="zuschuss">Zuschuss</option>
              <option value="darlehen">Darlehen</option>
              <option value="buergschaft">Bürgschaft</option>
            </select>
            <select
              className={inputCls}
              value={b.kategorie ?? 'allgemein'}
              onChange={(e) => setBeihilfe(i, { kategorie: e.target.value as Beihilfe['kategorie'] })}
            >
              <option value="allgemein">Allgemeine De-minimis-Beihilfe</option>
              <option value="agrar">Agrar</option>
              <option value="fisch">Fischerei</option>
            </select>
            <select
              className={inputCls}
              value={b.status ?? 'gewaehrt'}
              onChange={(e) => setBeihilfe(i, { status: e.target.value as Beihilfe['status'] })}
            >
              <option value="gewaehrt">Gewährt / bewilligt</option>
              <option value="beantragt">Beantragt, noch nicht bewilligt</option>
            </select>
            <div className="flex items-end justify-end">
              <button
                type="button"
                onClick={() => onChange('beihilfen', beihilfen.filter((_, j) => j !== i))}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Entfernen
              </button>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange('beihilfen', [...beihilfen, { beihilfegeber: '', form: 'zuschuss', kategorie: 'allgemein', status: 'gewaehrt' }])}
        className="self-start rounded-xl border border-dashed border-teal-600/50 px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50"
      >
        + Beihilfe hinzufügen
      </button>

      {/* Live-Summe */}
      <div
        className={`rounded-2xl p-5 text-sm font-semibold ${
          ueberschritten ? 'bg-red-50 text-red-800 ring-1 ring-red-200' : 'bg-teal-50 text-teal-900 ring-1 ring-teal-600/20'
        }`}
      >
        Summe der angegebenen Beihilfen: {formatEUR(summe)} von {formatEUR(HOECHSTBETRAG)}
        {ueberschritten
          ? ' – Höchstbetrag überschritten. Bitte kontaktieren Sie uns vor dem Absenden.'
          : ` – verbleibend: ${formatEUR(HOECHSTBETRAG - summe)}`}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-mabe-900">Ist Ihr Unternehmen in den letzten drei Jahren entstanden durch …</p>
        <Checkbox
          checked={(daten.fusion_3j as boolean) ?? false}
          onChange={(v) => onChange('fusion_3j', v)}
          label="… eine Fusion? (Dann sind die Beihilfen aller beteiligten Unternehmen anzugeben.)"
        />
        <Checkbox
          checked={(daten.uebernahme_3j as boolean) ?? false}
          onChange={(v) => onChange('uebernahme_3j', v)}
          label="… eine Übernahme?"
        />
        <Checkbox
          checked={(daten.aufspaltung_3j as boolean) ?? false}
          onChange={(v) => onChange('aufspaltung_3j', v)}
          label="… eine Unternehmensaufspaltung?"
        />
      </div>

      <Checkbox
        checked={(daten.bestaetigt as boolean) ?? false}
        onChange={(v) => onChange('bestaetigt', v)}
        fehler={fehler.bestaetigt}
        label={
          <>
            Ich bestätige, dass meine Angaben vollständig und wahrheitsgemäß sind. Mir ist bekannt, dass diese Angaben{' '}
            <strong>subventionserheblich im Sinne des § 264 StGB</strong> sind und unrichtige oder unvollständige
            Angaben strafbar sein können.
          </>
        }
      />
    </div>
  )
}
