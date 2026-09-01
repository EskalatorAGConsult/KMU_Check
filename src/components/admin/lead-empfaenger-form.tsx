'use client'

import { useState, useTransition } from 'react'

import { speichereLeadEmpfaenger } from '@/lib/admin/einstellungen-actions'

/**
 * Formular fuer die Empfaenger der Lead-Benachrichtigung (Admin-Einstellungen).
 * Mehrere Adressen per Komma oder Semikolon. Leer = Standard-Empfaenger.
 */
export function LeadEmpfaengerForm({ initialWert }: { initialWert: string }) {
  const [wert, setWert] = useState(initialWert)
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const speichern = () => {
    setMeldung(null)
    startTransition(async () => {
      const res = await speichereLeadEmpfaenger(wert)
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis ?? 'Gespeichert.' } : { art: 'fehler', text: res.fehler })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="lead-empfaenger" className="mb-1.5 block text-sm font-semibold text-mabe-900">
          Empfänger der Lead-Benachrichtigung
        </label>
        <input
          id="lead-empfaenger"
          type="text"
          inputMode="email"
          value={wert}
          onChange={(e) => setWert(e.target.value)}
          placeholder="robin@eskalator.ag, vertrieb@mabe.de, …"
          className="w-full rounded-xl border border-olive-300 bg-white px-4 py-3 text-base text-mabe-900 placeholder:text-olive-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 focus:outline-none sm:text-sm"
        />
        <p className="mt-1.5 text-xs/5 text-olive-500">
          Mehrere Adressen per Komma oder Semikolon trennen. Leer lassen, um den Standard (
          <code>robin@eskalator.ag</code>) bzw. den ENV-Fallback (<code>LEAD_EMAIL_AN</code>) zu nutzen. Die
          Benachrichtigung enthält alle Lead-Angaben als kopierfähige Tabellen (KMU-Ergebnis, Verflechtung,
          Kontaktdaten).
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={speichern}
          disabled={pending}
          className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {pending ? 'Bitte warten …' : 'Speichern'}
        </button>
      </div>

      {meldung && (
        <p
          role="status"
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
