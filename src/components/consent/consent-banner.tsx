'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  COOKIE_KATALOG,
  CONSENT_OPEN_EVENT,
  leseEinwilligung,
  speichereEinwilligung,
  type EinwilligungsKategorie,
} from '@/lib/consent'

/**
 * DSGVO-Consent-Banner (Opt-in): Erscheint, bis eine Einwilligungsentscheidung
 * vorliegt. Keine nicht-notwendige Verarbeitung vor aktiver Zustimmung –
 * das Tracking (tracking.ts) startet erst nach dem Event CONSENT_EVENT.
 * Ueber „Cookie-Einstellungen" im Footer jederzeit wieder aufrufbar (Widerruf).
 */

const toggleCls = (aktiv: boolean, deaktiviert?: boolean) =>
  `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
    deaktiviert ? 'cursor-not-allowed bg-teal-600/40' : aktiv ? 'bg-teal-600' : 'bg-olive-300'
  }`

function Toggle({
  aktiv,
  deaktiviert,
  onChange,
  label,
}: {
  aktiv: boolean
  deaktiviert?: boolean
  onChange?: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktiv}
      aria-label={label}
      disabled={deaktiviert}
      onClick={() => onChange?.(!aktiv)}
      className={toggleCls(aktiv, deaktiviert)}
    >
      <span
        className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
          aktiv ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export function ConsentBanner() {
  const [sichtbar, setSichtbar] = useState(false)
  const [einstellungen, setEinstellungen] = useState(false)
  const [auswahl, setAuswahl] = useState<Record<EinwilligungsKategorie, boolean>>({
    statistik: false,
    marketing: false,
  })

  // Beim Mount: Entscheidung vorhanden? Sonst Banner zeigen. Der Status wird
  // verzoegert (hinter die Hydration) gesetzt, damit SSR und Client identisch
  // starten – kein Flash falscher Inhalte, kein setState direkt im Effekt.
  useEffect(() => {
    const aktuell = leseEinwilligung()
    const frame = requestAnimationFrame(() => {
      if (!aktuell) setSichtbar(true)
      else setAuswahl({ statistik: aktuell.statistik, marketing: aktuell.marketing })
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  // Footer-Link „Cookie-Einstellungen" oeffnet den Dialog erneut (Widerruf).
  useEffect(() => {
    const oeffnen = () => {
      const aktuell = leseEinwilligung()
      if (aktuell) setAuswahl({ statistik: aktuell.statistik, marketing: aktuell.marketing })
      setEinstellungen(true)
      setSichtbar(true)
    }
    window.addEventListener(CONSENT_OPEN_EVENT, oeffnen)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, oeffnen)
  }, [])

  const entscheiden = useCallback((statistik: boolean, marketing: boolean) => {
    speichereEinwilligung({ statistik, marketing })
    setSichtbar(false)
    setEinstellungen(false)
  }, [])

  if (!sichtbar) return null

  return (
    <>
      {/* Kompakt-Banner: mobil Bottom-Sheet, ab sm zentrierte Karte */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Cookie- und Datenschutzeinstellungen"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-olive-200 bg-white/98 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md sm:rounded-2xl sm:border sm:p-5"
      >
        <p className="text-sm font-semibold text-mabe-900">Ihre Privatsphäre – Sie entscheiden</p>
        <p className="mt-1.5 text-xs/5 text-olive-600">
          Wir nutzen Cookies und vergleichbare Techniken, um die Seite zu betreiben und – nur mit Ihrer
          Einwilligung – die Nutzung unseres KMU-Checks zu analysieren und unsere Werbung zu messen.{' '}
          <a href="https://www.mabe.de/datenschutz" className="font-medium text-teal-700 underline">
            Datenschutzerklärung
          </a>
        </p>
        <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => entscheiden(true, true)}
            className="min-h-11 flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50"
          >
            Alle akzeptieren
          </button>
          <button
            type="button"
            onClick={() => entscheiden(false, false)}
            className="min-h-11 flex-1 rounded-xl border border-olive-300 bg-white px-4 py-2.5 text-sm font-semibold text-mabe-900 hover:bg-olive-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mabe-900/30"
          >
            Nur erforderliche
          </button>
          <button
            type="button"
            onClick={() => setEinstellungen(true)}
            aria-expanded={einstellungen}
            className="min-h-11 flex-1 rounded-xl border border-olive-300 bg-white px-4 py-2.5 text-sm font-semibold text-mabe-900 hover:bg-olive-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mabe-900/30"
          >
            Einstellungen
          </button>
        </div>
      </div>

      {/* Einstellungs-Dialog: Kategorien mit vollstaendigem Cookie-Verzeichnis */}
      {einstellungen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cookie-Einstellungen im Detail"
          className="fixed inset-0 z-50 flex items-end justify-center bg-mabe-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEinstellungen(false)
          }}
        >
          <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-olive-100 p-5">
              <div>
                <h2 className="text-base font-semibold text-mabe-900">Cookie-Einstellungen</h2>
                <p className="mt-1 text-xs/5 text-olive-600">
                  Wählen Sie pro Kategorie, ob Sie einwilligen. Ihre Auswahl wird 6 Monate gespeichert und kann
                  jederzeit über „Cookie-Einstellungen“ im Seitenfuß geändert oder widerrufen werden.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEinstellungen(false)}
                aria-label="Einstellungen schließen"
                className="rounded-lg p-1.5 text-olive-500 hover:bg-olive-50 hover:text-mabe-900"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex flex-col gap-4">
                {COOKIE_KATALOG.map((kat) => {
                  const istNotwendig = kat.id === 'notwendig'
                  const aktiv = istNotwendig ? true : auswahl[kat.id as EinwilligungsKategorie]
                  return (
                    <section key={kat.id} className="rounded-xl border border-olive-200">
                      <div className="flex items-start justify-between gap-4 p-4">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-mabe-900">{kat.titel}</h3>
                          <p className="mt-1 text-xs/5 text-olive-600">{kat.beschreibung}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-1">
                          <Toggle
                            aktiv={aktiv}
                            deaktiviert={istNotwendig}
                            label={`${kat.titel} ${aktiv ? 'aktiviert' : 'deaktiviert'}`}
                            onChange={
                              istNotwendig
                                ? undefined
                                : (v) => setAuswahl((a) => ({ ...a, [kat.id]: v }))
                            }
                          />
                          {istNotwendig && <span className="text-[10px] font-medium text-olive-500">immer aktiv</span>}
                        </div>
                      </div>
                      <div className="overflow-x-auto border-t border-olive-100">
                        <table className="w-full min-w-[30rem] border-collapse text-left">
                          <thead>
                            <tr className="bg-olive-50 text-[11px] text-olive-500">
                              <th className="px-4 py-2 font-semibold">Name</th>
                              <th className="px-4 py-2 font-semibold">Anbieter</th>
                              <th className="px-4 py-2 font-semibold">Zweck</th>
                              <th className="px-4 py-2 font-semibold">Dauer</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-olive-100">
                            {kat.eintraege.map((e) => (
                              <tr key={e.name}>
                                <td className="px-4 py-2.5 font-mono text-[11px] break-all text-mabe-900">{e.name}</td>
                                <td className="px-4 py-2.5 text-xs/5 text-olive-600">{e.anbieter}</td>
                                <td className="px-4 py-2.5 text-xs/5 text-olive-600">{e.zweck}</td>
                                <td className="px-4 py-2.5 text-xs/5 whitespace-nowrap text-olive-600">{e.dauer}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-olive-100 p-4 sm:flex-row">
              <button
                type="button"
                onClick={() => entscheiden(auswahl.statistik, auswahl.marketing)}
                className="min-h-11 flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50"
              >
                Auswahl speichern
              </button>
              <button
                type="button"
                onClick={() => entscheiden(true, true)}
                className="min-h-11 flex-1 rounded-xl border border-olive-300 bg-white px-4 py-2.5 text-sm font-semibold text-mabe-900 hover:bg-olive-50"
              >
                Alle akzeptieren
              </button>
              <button
                type="button"
                onClick={() => entscheiden(false, false)}
                className="min-h-11 flex-1 rounded-xl border border-olive-300 bg-white px-4 py-2.5 text-sm font-semibold text-mabe-900 hover:bg-olive-50"
              >
                Nur erforderliche
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
