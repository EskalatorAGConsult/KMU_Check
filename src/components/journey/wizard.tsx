'use client'

import { useState, useTransition } from 'react'

import type { Angebot } from '@/lib/db/types'
import { schliesseJourneyAb, speichereSchritt } from '@/lib/journey/actions'
import { SCHRITTE } from '@/lib/journey/schritte'
import { schemaFuerSchritt } from '@/lib/journey/schemas'
import { Fortschritt } from './fortschritt'
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
  const [gespeichert, setGespeichert] = useState(false)
  const [abgeschlossen, setAbgeschlossen] = useState(false)
  const [busy, startTransition] = useTransition()

  const schritt = SCHRITTE[idx]
  const schrittDaten = daten[schritt.id] ?? {}
  const istLetzter = idx === SCHRITTE.length - 1
  const investSumme =
    (angebot.invest_software ?? 0) + (angebot.invest_messtechnik ?? 0) + (angebot.invest_steuerung ?? 0) || null

  const setze = (name: string, wert: unknown) => {
    setDaten((d) => ({ ...d, [schritt.id]: { ...d[schritt.id], [name]: wert } }))
    setGespeichert(false)
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
      if (res.ok) {
        setGespeichert(true)
        weiter()
      } else setHinweis(res.fehler)
    })
  }

  const onWeiter = () => {
    if (!validiereAktuellenSchritt()) {
      // Zum ersten Fehler scrollen, damit er auf kleinen Viewports sichtbar ist.
      requestAnimationFrame(() => {
        document.querySelector('[role="alert"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }
    speichern(() => {
      setIdx((i) => Math.min(i + 1, SCHRITTE.length - 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  const onSprung = (ziel: number) => {
    if (ziel === idx) return
    speichern(() => {
      setIdx(ziel)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  const onAbsenden = () => {
    if (!validiereAktuellenSchritt()) return
    startTransition(async () => {
      setHinweis(null)
      const res = await schliesseJourneyAb(token, daten)
      if (res.ok) {
        setAbgeschlossen(true)
        window.scrollTo({ top: 0 })
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
    <div>
      <Fortschritt idx={idx} onSprung={onSprung} />

      {/* zusaetzlicher Platz unten, damit die mobile Sticky-Actionbar nichts verdeckt */}
      <div className="flex flex-col gap-6 pt-6 pb-32 sm:gap-8 sm:pt-8 md:pb-8">
        {/* Kopf: Titel + Laien-Erklaerung */}
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-2xl font-semibold text-balance text-mabe-900 sm:text-3xl">
            {schritt.titel}
          </h1>
          {schritt.beschreibung && <p className="text-sm/6 text-olive-600 sm:text-base/7">{schritt.beschreibung}</p>}
          {schritt.erklaerung && (
            <div className="flex gap-3 rounded-2xl border border-teal-600/20 bg-teal-50/70 p-4">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="mt-0.5 size-5 shrink-0 text-teal-700"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm/6 text-teal-900">{schritt.erklaerung}</p>
            </div>
          )}
        </header>

        {/* Schritt-Inhalt (Registry ueber komponente) */}
        {schritt.komponente === 'uebersicht' && <SchrittUebersicht angebot={angebot} />}
        {schritt.komponente === 'generisch' && (
          <StepGenerisch schritt={schritt} daten={schrittDaten} fehler={fehler} onChange={setze} />
        )}
        {schritt.komponente === 'kmu' && (
          <SchrittKmu daten={schrittDaten} fehler={fehler} investSumme={investSumme} onChange={setze} />
        )}
        {schritt.komponente === 'deminimis' && (
          <SchrittDeminimis daten={schrittDaten} fehler={fehler} onChange={setze} />
        )}
        {schritt.komponente === 'vollmacht' && (
          <SchrittVollmacht daten={schrittDaten} fehler={fehler} onChange={setze} />
        )}

        {hinweis && (
          <p
            className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200"
            role="alert"
          >
            {hinweis}
          </p>
        )}
        {gespeichert && !hinweis && (
          <p className="flex items-center gap-2 text-xs/5 text-olive-500" role="status">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-teal-600" aria-hidden>
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
            Zwischengespeichert – Sie können den Link jederzeit wieder öffnen und fortsetzen.
          </p>
        )}

        {/* Navigation: mobil sticky unten (Daumen-Reichweite), ab md klassisch im Fluss */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-olive-200 bg-white/95 px-4 py-3 backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="mx-auto flex max-w-3xl items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => speichern(() => setIdx((i) => Math.max(i - 1, 0)))}
              disabled={idx === 0 || busy}
              className="min-h-12 shrink-0 rounded-xl px-4 py-3 text-sm font-semibold text-olive-600 transition-colors hover:bg-olive-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 disabled:opacity-40"
            >
              ← Zurück
            </button>
            <button
              type="button"
              onClick={() =>
                speichern(() => setHinweis(null))
              }
              disabled={busy}
              className="hidden min-h-12 shrink-0 rounded-xl px-3 py-3 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-40 sm:block"
              title="Ihre Eingaben werden gespeichert – Sie können den Link später erneut öffnen und fortsetzen."
            >
              Speichern & später fortfahren
            </button>
            {istLetzter ? (
              <button
                type="button"
                onClick={onAbsenden}
                disabled={busy}
                className="min-h-12 flex-1 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 focus-visible:ring-offset-2 disabled:opacity-50 md:flex-none"
              >
                {busy ? 'Wird gesendet …' : 'Verbindlich absenden ✓'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onWeiter}
                disabled={busy}
                className="min-h-12 flex-1 rounded-xl bg-mabe-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mabe-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-mabe-900/40 focus-visible:ring-offset-2 disabled:opacity-50 md:flex-none"
              >
                {busy ? 'Speichert …' : 'Speichern & weiter →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Erfolg({ angebot }: { angebot: Angebot }) {
  const schritte = [
    {
      titel: 'Prüfung Ihrer Angaben',
      text: 'Das Fördermittel-Team prüft Ihre Angaben auf Vollständigkeit und meldet sich bei offenen Punkten.',
    },
    {
      titel: 'Antragstellung beim BAFA',
      text:
        angebot.status === 'eingereicht'
          ? 'Ihr Antrag wird vorbereitet und im FZD-Portal eingereicht.'
          : 'Ihr Antrag wird vorbereitet und eingereicht – Sie müssen nichts weiter tun.',
    },
    {
      titel: 'Bewilligung & Umsetzung',
      text: 'Nach dem Zuwendungsbescheid kann die Maßnahme starten. Der Zuschuss wird nach Verwendungsnachweis ausgezahlt.',
    },
  ]

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-4 py-10 text-center sm:py-14">
      <span className="flex size-16 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-600/20 sm:size-20">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-8 sm:size-10">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </span>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-semibold text-balance text-mabe-900 sm:text-3xl">
          Geschafft – Ihre Angaben sind vollständig!
        </h1>
        <p className="text-sm/6 text-olive-600 sm:text-base/7">
          Ihr Vorgang <strong className="text-mabe-900">{angebot.angebot_nr}</strong> wurde übermittelt.{' '}
          {angebot.kunde_ansprechpartner
            ? `${angebot.kunde_ansprechpartner} von MABE`
            : 'Ihr Ansprechpartner bei MABE'}{' '}
          und das Fördermittel-Team kümmern sich jetzt um alles Weitere.
        </p>
      </div>

      {/* Wie geht es weiter? */}
      <ol className="flex w-full flex-col gap-3 text-left">
        <p className="text-xs font-semibold tracking-wide text-olive-500 uppercase">Wie geht es jetzt weiter?</p>
        {schritte.map((s, i) => (
          <li key={s.titel} className="flex gap-4 rounded-2xl border border-olive-200 bg-white p-4 sm:p-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mabe-900 text-sm font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-mabe-900">{s.titel}</p>
              <p className="mt-0.5 text-sm/6 text-olive-600">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs/5 text-olive-500">
        Bewahren Sie diesen Link auf – er dokumentiert Ihren Vorgang. Bei Rückfragen genügt die Angabe der
        Angebotsnummer.
      </p>

      {/* Konto-Empfehlung */}
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-mabe-900 p-6 text-white">
        <p className="text-base font-semibold">Status jederzeit im Blick behalten</p>
        <p className="max-w-md text-sm/6 text-olive-200">
          Legen Sie ein kostenloses Konto an und öffnen Sie danach diesen Link erneut – Ihr Vorgang wird dann
          automatisch Ihrem Konto zugeordnet. Sie sehen dort Status und eingereichte Angaben jederzeit auf einen
          Blick.
        </p>
        <a
          href="/konto/registrieren"
          className="min-h-12 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
        >
          Kostenloses Konto anlegen →
        </a>
      </div>
    </div>
  )
}
