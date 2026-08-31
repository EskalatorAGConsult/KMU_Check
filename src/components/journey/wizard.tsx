'use client'

import { useState, useTransition } from 'react'

import type { Angebot } from '@/lib/db/types'
import { schliesseJourneyAb, speichereSchritt } from '@/lib/journey/actions'
import { SCHRITTE } from '@/lib/journey/schritte'
import { schemaFuerSchritt } from '@/lib/journey/schemas'
import { SchrittDeminimis } from './schritt-deminimis'
import { SchrittKmu } from './schritt-kmu'
import { SchrittUebersicht } from './schritt-uebersicht'
import { SchrittVollmacht } from './schritt-vollmacht'
import { StepGenerisch } from './step-generisch'

type SchrittDaten = Record<string, Record<string, unknown>>

function fehlerAusZod(error: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> {
  const map: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_')
    if (!map[key]) map[key] = issue.message
  }
  return map
}

/**
 * Der Journey-Wizard. Vollstaendig getrieben von SCHRITTE (schritte.ts):
 * Fortschritt, Navigation, Validierung und Speicherung folgen der Konfiguration.
 */
export function Wizard({
  token,
  angebot,
  initialDaten,
  startSchritt,
}: {
  token: string
  angebot: Angebot
  initialDaten: SchrittDaten
  startSchritt: string
}) {
  const initialIndex = Math.max(0, SCHRITTE.findIndex((s) => s.id === startSchritt))
  const [idx, setIdx] = useState(initialIndex)
  const [daten, setDaten] = useState<SchrittDaten>(initialDaten)
  const [fehler, setFehler] = useState<Record<string, string>>({})
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [abgeschlossen, setAbgeschlossen] = useState(false)
  const [busy, startTransition] = useTransition()

  const schritt = SCHRITTE[idx]
  const schrittDaten = daten[schritt.id] ?? {}
  const istLetzter = idx === SCHRITTE.length - 1

  const setze = (name: string, wert: unknown) => {
    setDaten((d) => ({ ...d, [schritt.id]: { ...d[schritt.id], [name]: wert } }))
    setFehler((f) => {
      if (!f[name]) return f
      const rest = { ...f }
      delete rest[name]
      return rest
    })
  }

  const validiereAktuellenSchritt = (): boolean => {
    const res = schemaFuerSchritt(schritt).safeParse(schrittDaten)
    if (res.success) {
      setFehler({})
      return true
    }
    setFehler(fehlerAusZod(res.error))
    return false
  }

  const speichern = (weiter: () => void) => {
    startTransition(async () => {
      setHinweis(null)
      const res = await speichereSchritt(token, schritt.id, schrittDaten)
      if (res.ok) weiter()
      else setHinweis(res.fehler)
    })
  }

  const onWeiter = () => {
    if (!validiereAktuellenSchritt()) return
    speichern(() => setIdx((i) => Math.min(i + 1, SCHRITTE.length - 1)))
  }

  const onAbsenden = () => {
    if (!validiereAktuellenSchritt()) return
    startTransition(async () => {
      setHinweis(null)
      const res = await schliesseJourneyAb(token, daten)
      if (res.ok) {
        setAbgeschlossen(true)
        return
      }
      if (res.schrittFehler) {
        const zielId = Object.keys(res.schrittFehler)[0]
        const zielIdx = SCHRITTE.findIndex((s) => s.id === zielId)
        if (zielIdx >= 0) setIdx(zielIdx)
        setHinweis(`${res.fehler} (${SCHRITTE[zielIdx]?.titel ?? zielId}: ${res.schrittFehler[zielId]})`)
      } else {
        setHinweis(res.fehler)
      }
    })
  }

  if (abgeschlossen) return <Erfolg angebot={angebot} />

  return (
    <div className="flex flex-col gap-8">
      {/* Fortschritt */}
      <nav aria-label="Fortschritt" className="flex flex-col gap-3">
        <ol className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {SCHRITTE.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <span
                className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                  i < idx
                    ? 'bg-teal-600 text-white'
                    : i === idx
                      ? 'bg-mabe-900 text-white'
                      : 'bg-olive-100 text-olive-500'
                }`}
              >
                {i < idx ? '✓' : i + 1}
              </span>
              <span
                className={`text-sm ${i === idx ? 'font-semibold text-mabe-900' : 'text-olive-500'} max-sm:hidden`}
              >
                {s.titel}
              </span>
              {i < SCHRITTE.length - 1 && <span className="h-px w-4 bg-olive-200 max-sm:hidden" />}
            </li>
          ))}
        </ol>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-olive-100">
          <div
            className="h-full rounded-full bg-teal-600 transition-all"
            style={{ width: `${((idx + 1) / SCHRITTE.length) * 100}%` }}
          />
        </div>
      </nav>

      {/* Kopf */}
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold text-mabe-900">{schritt.titel}</h1>
        {schritt.beschreibung && <p className="text-olive-600">{schritt.beschreibung}</p>}
      </header>

      {/* Schritt-Inhalt (Registry ueber komponente) */}
      {schritt.komponente === 'uebersicht' && <SchrittUebersicht angebot={angebot} />}
      {schritt.komponente === 'generisch' && (
        <StepGenerisch schritt={schritt} daten={schrittDaten} fehler={fehler} onChange={setze} />
      )}
      {schritt.komponente === 'kmu' && <SchrittKmu daten={schrittDaten} fehler={fehler} onChange={setze} />}
      {schritt.komponente === 'deminimis' && (
        <SchrittDeminimis daten={schrittDaten} fehler={fehler} onChange={setze} />
      )}
      {schritt.komponente === 'vollmacht' && (
        <SchrittVollmacht daten={schrittDaten} fehler={fehler} onChange={setze} />
      )}

      {hinweis && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200" role="alert">
          {hinweis}
        </p>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-olive-200 pt-6">
        <button
          type="button"
          onClick={() => speichern(() => setIdx((i) => Math.max(i - 1, 0)))}
          disabled={idx === 0 || busy}
          className="rounded-xl px-4 py-3 text-sm font-semibold text-olive-600 hover:bg-olive-50 disabled:opacity-40"
        >
          ← Zurück
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => speichern(() => setHinweis('Gespeichert – Sie können diesen Link jederzeit wieder öffnen und fortsetzen.'))}
            disabled={busy}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-40"
          >
            Speichern & später fortfahren
          </button>
          {istLetzter ? (
            <button
              type="button"
              onClick={onAbsenden}
              disabled={busy}
              className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50"
            >
              {busy ? 'Wird gesendet …' : 'Verbindlich absenden'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onWeiter}
              disabled={busy}
              className="rounded-xl bg-mabe-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-mabe-800 disabled:opacity-50"
            >
              {busy ? 'Speichert …' : 'Weiter →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Erfolg({ angebot }: { angebot: Angebot }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-600/20">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </span>
      <h1 className="font-display text-3xl font-semibold text-mabe-900">Vielen Dank – Ihre Angaben sind vollständig.</h1>
      <p className="text-olive-600">
        Ihr Vorgang <strong className="text-mabe-900">{angebot.angebot_nr}</strong> wurde übermittelt.{' '}
        {angebot.kunde_ansprechpartner
          ? `${angebot.kunde_ansprechpartner} von MABE`
          : 'Ihr Ansprechpartner bei MABE'}{' '}
        und das Fördermittel-Team kümmern sich um die nächsten Schritte und melden sich bei Ihnen.
      </p>
      <p className="text-sm text-olive-500">
        Bewahren Sie diesen Link auf – er dokumentiert Ihren Vorgang. Bei Rückfragen genügt die Angabe der
        Angebotsnummer.
      </p>
    </div>
  )
}
