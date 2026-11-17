'use client'

import { useState, useTransition } from 'react'

import { pruefeFristenJetzt, speichereFristErinnerungen } from '@/lib/admin/einstellungen-actions'

/**
 * Fristen-Erinnerungen (Admin-Einstellungen): konfigurierbare Vorlauf-Zeiten
 * für Durchführungszeitraum-Ende und VNW-Vorlagefrist plus Manuell-Lauf
 * (derselbe Code wie der tägliche Vercel-Cron, sofortiges Feedback).
 */
export function FristErinnerungForm({
  initialZeitraum,
  initialVnw,
}: {
  initialZeitraum: string
  initialVnw: string
}) {
  const [zeitraum, setZeitraum] = useState(initialZeitraum)
  const [vnw, setVnw] = useState(initialVnw)
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const inputCls =
    'w-full rounded-xl border border-olive-300 bg-white px-4 py-3 text-base text-mabe-900 ' +
    'focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 focus:outline-none sm:text-sm'

  const speichern = () => {
    setMeldung(null)
    startTransition(async () => {
      const res = await speichereFristErinnerungen(zeitraum, vnw)
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis ?? 'Gespeichert.' } : { art: 'fehler', text: res.fehler })
    })
  }

  const jetztPruefen = () => {
    setMeldung(null)
    startTransition(async () => {
      const res = await pruefeFristenJetzt()
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis } : { art: 'fehler', text: res.fehler })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor="frist-zeitraum" className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-mabe-900">
            Vorlauf: Ende Durchführungszeitraum (Tage)
          </span>
          <input
            id="frist-zeitraum"
            type="number"
            min={1}
            max={180}
            step={1}
            inputMode="numeric"
            value={zeitraum}
            onChange={(e) => setZeitraum(e.target.value)}
            className={inputCls}
          />
          <span className="text-xs/5 text-olive-500">
            Erinnerung an das Team, bevor der im Bescheid genannte Zeitraum abläuft (Standard 14).
          </span>
        </label>
        <label htmlFor="frist-vnw" className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-mabe-900">Vorlauf: VNW-Vorlagefrist (Tage)</span>
          <input
            id="frist-vnw"
            type="number"
            min={1}
            max={180}
            step={1}
            inputMode="numeric"
            value={vnw}
            onChange={(e) => setVnw(e.target.value)}
            className={inputCls}
          />
          <span className="text-xs/5 text-olive-500">
            Erinnerung, bevor die Verwendungsnachweis-Frist abläuft, nur solange nicht eingereicht (Standard 28).
          </span>
        </label>
      </div>
      <p className="text-xs/5 text-olive-500">
        Versand täglich per Cron (07:00 MEZ) und über den Button, idempotent je Vorgang und Frist; Empfänger wie
        die Lead-Benachrichtigung.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={speichern}
          disabled={pending}
          className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-500 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90 disabled:opacity-50"
        >
          {pending ? 'Bitte warten …' : 'Speichern'}
        </button>
        <button
          type="button"
          onClick={jetztPruefen}
          disabled={pending}
          className="rounded-xl border border-teal-600 bg-white px-5 py-2.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90 disabled:opacity-50"
        >
          Jetzt prüfen und erinnern
        </button>
      </div>
      {meldung && (
        <p
          role={meldung.art === 'ok' ? 'status' : 'alert'}
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            meldung.art === 'ok' ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {meldung.text}
        </p>
      )}
    </div>
  )
}
