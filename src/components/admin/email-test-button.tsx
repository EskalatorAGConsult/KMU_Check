'use client'

import { useState, useTransition } from 'react'

import { testeEmailVersand } from '@/lib/admin/einstellungen-actions'

/** Testversand-Button: schickt eine Test-Mail an den fest hinterlegten Empfänger (einstellungen-actions.ts). */
export function EmailTestButton() {
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMeldung(null)
          startTransition(async () => {
            const res = await testeEmailVersand()
            setMeldung(res.ok ? { art: 'ok', text: res.hinweis ?? 'Test-Mail gesendet.' } : { art: 'fehler', text: res.fehler })
          })
        }}
        className="w-fit rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
      >
        {pending ? 'Sende Test-Mail …' : 'Test-Mail an robin@eskalator.ag senden'}
      </button>
      {meldung && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-xs/5 font-medium ${
            meldung.art === 'ok' ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {meldung.text}
        </p>
      )}
    </div>
  )
}
