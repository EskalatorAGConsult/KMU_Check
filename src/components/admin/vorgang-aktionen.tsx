'use client'

import { useState, useTransition } from 'react'

import { erneutEinladen, widerrufeVorgang } from '@/lib/admin/kunden-actions'

/** Aktions-Buttons pro Vorgang in der Kundenverwaltung. */
export function VorgangAktionen({ angebotId, status }: { angebotId: string; status: string }) {
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const einladbar = !['eingereicht', 'abgeschlossen', 'widerrufen'].includes(status)
  const widerrufbar = status !== 'widerrufen'

  const ausfuehren = (aktion: () => Promise<{ ok: true; hinweis: string } | { ok: false; fehler: string }>) => {
    setMeldung(null)
    startTransition(async () => {
      const res = await aktion()
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis } : { art: 'fehler', text: res.fehler })
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {einladbar && (
          <button
            type="button"
            disabled={pending}
            onClick={() => ausfuehren(() => erneutEinladen(angebotId))}
            className="rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
          >
            Einladung erneut senden
          </button>
        )}
        {widerrufbar && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm('Vorgang wirklich widerrufen? Bestehende Kunden-Links verlieren ihre Gültigkeit.')) {
                ausfuehren(() => widerrufeVorgang(angebotId))
              }
            }}
            className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Vorgang widerrufen
          </button>
        )}
      </div>
      {meldung && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-xs font-medium ${
            meldung.art === 'ok' ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {meldung.text}
        </p>
      )}
    </div>
  )
}
