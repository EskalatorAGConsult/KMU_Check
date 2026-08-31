'use client'

import { useState, useTransition } from 'react'

import { speichereWebhookUrl, testeWebhook } from '@/lib/admin/einstellungen-actions'

/**
 * Formular fuer die individuelle Webhook-URL (Admin-Einstellungen).
 * Speichern + Test-Ping mit sofortigem Feedback.
 */
export function WebhookForm({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl)
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const speichern = () => {
    setMeldung(null)
    startTransition(async () => {
      const res = await speichereWebhookUrl(url)
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis ?? 'Gespeichert.' } : { art: 'fehler', text: res.fehler })
    })
  }

  const testen = () => {
    setMeldung(null)
    startTransition(async () => {
      const res = await testeWebhook()
      setMeldung(
        res.ok
          ? { art: 'ok', text: `Test erfolgreich – HTTP ${res.status} (Quelle: ${res.quelle}).` }
          : { art: 'fehler', text: res.fehler },
      )
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="webhook-url" className="mb-1.5 block text-sm font-semibold text-mabe-900">
          Webhook-URL
        </label>
        <input
          id="webhook-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… (z. B. n8n-, Make- oder CRM-Endpoint)"
          className="w-full rounded-xl border border-olive-300 bg-white px-4 py-3 text-base text-mabe-900 placeholder:text-olive-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 focus:outline-none sm:text-sm"
        />
        <p className="mt-1.5 text-xs/5 text-olive-500">
          Leer lassen, um den ENV-Fallback (<code>WEBHOOK_URL</code> aus Vercel) zu nutzen. Die URL wird
          ausschließlich serverseitig verwendet und niemals an den Browser ausgeliefert.
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
        <button
          type="button"
          onClick={testen}
          disabled={pending}
          className="rounded-xl border border-olive-300 bg-white px-5 py-2.5 text-sm font-semibold text-mabe-900 hover:bg-olive-50 disabled:opacity-50"
        >
          Test-Ping senden
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
