'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { notizHinzufuegen, notizLoeschen } from '@/lib/admin/kunden-actions'
import type { VorgangNotizRow } from '@/lib/db/types'

/**
 * Interne Berater-Notizen mit Wiedervorlage (Migration 21): Telefonate,
 * Absprachen, fehlende Unterlagen – mit optionalem Faeligkeitsdatum.
 * Ueberfaellige Wiedervorlagen werden farblich markiert.
 */
export function VorgangNotizen({
  angebotId,
  notizen,
  bearbeiter,
  onGespeichert,
}: {
  angebotId: string
  notizen: VorgangNotizRow[]
  bearbeiter: Record<string, string>
  onGespeichert?: () => void
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [datum, setDatum] = useState('')
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const heute = new Date().toISOString().slice(0, 10)

  const speichern = () => {
    setMeldung(null)
    startTransition(async () => {
      const res = await notizHinzufuegen(angebotId, text, datum || null)
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis } : { art: 'fehler', text: res.fehler })
      if (res.ok) {
        setText('')
        setDatum('')
        router.refresh()
        onGespeichert?.()
      }
    })
  }

  const entfernen = (notizId: string) => {
    if (!window.confirm('Notiz wirklich löschen?')) return
    startTransition(async () => {
      const res = await notizLoeschen(notizId, angebotId)
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis } : { art: 'fehler', text: res.fehler })
      if (res.ok) {
        router.refresh()
        onGespeichert?.()
      }
    })
  }

  const inputCls =
    'w-full rounded-lg border border-olive-300 bg-white px-3 py-2 text-sm text-mabe-900 placeholder:text-olive-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30'

  return (
    <div className="flex flex-col gap-4">
      {/* Erfassung */}
      <div className="flex flex-col gap-2.5 rounded-xl bg-olive-50/60 p-4 ring-1 ring-olive-200">
        <label className="text-xs font-semibold text-mabe-900">
          Neue Notiz (intern – der Kunde sieht diese nicht)
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="z. B. Kunde angerufen – Steuernummer und IBAN kommen bis Freitag per Mail …"
            className={`${inputCls} mt-1`}
          />
        </label>
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="text-xs font-semibold text-mabe-900">
            Wiedervorlage am (optional)
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <button
            type="button"
            disabled={pending || text.trim().length === 0}
            onClick={speichern}
            className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {pending ? 'Speichert …' : 'Notiz speichern'}
          </button>
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

      {/* Timeline */}
      {notizen.length === 0 ? (
        <p className="text-xs text-olive-500">Noch keine internen Notizen vorhanden.</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {notizen.map((n) => {
            const ueberfaellig = n.wiedervorlage_am != null && n.wiedervorlage_am < heute
            return (
              <li key={n.id} className="rounded-xl bg-white px-4 py-3 ring-1 ring-olive-200">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs text-olive-500">
                    {new Date(n.created_at).toLocaleString('de-DE')} ·{' '}
                    <span className="font-semibold text-mabe-900">{bearbeiter[n.autor] ?? 'Unbekannt'}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {n.wiedervorlage_am && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          ueberfaellig ? 'bg-red-100 text-red-700' : 'bg-mabe-100 text-mabe-800'
                        }`}
                      >
                        Wiedervorlage {new Date(n.wiedervorlage_am).toLocaleDateString('de-DE')}
                        {ueberfaellig ? ' · überfällig' : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => entfernen(n.id)}
                      disabled={pending}
                      aria-label="Notiz löschen"
                      className="text-olive-400 hover:text-red-600 disabled:opacity-50"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
                        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm/6 whitespace-pre-wrap text-mabe-900">{n.text}</p>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
