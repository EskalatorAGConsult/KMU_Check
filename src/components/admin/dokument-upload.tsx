'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import { ladeDokumentHochAdmin } from '@/lib/admin/kunden-actions'

/**
 * Generischer Dokumenten-Upload zur Fallakte (Admin): PDF/PNG/JPG bis 15 MB,
 * z. B. BAFA-Bescheid, unterschriebene Papier-Vollmacht, Verwendungsnachweis.
 */
export function DokumentUpload({ angebotId, onGespeichert }: { angebotId: string; onGespeichert?: () => void }) {
  const router = useRouter()
  const dateiRef = useRef<HTMLInputElement>(null)
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const hochladen = () => {
    const datei = dateiRef.current?.files?.[0]
    if (!datei) {
      setMeldung({ art: 'fehler', text: 'Bitte zuerst eine Datei auswählen.' })
      return
    }
    setMeldung(null)
    const formData = new FormData()
    formData.set('datei', datei)
    startTransition(async () => {
      const res = await ladeDokumentHochAdmin(angebotId, formData)
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis } : { art: 'fehler', text: res.fehler })
      if (res.ok) {
        if (dateiRef.current) dateiRef.current.value = ''
        router.refresh()
        onGespeichert?.()
      }
    })
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-olive-50/60 p-4 ring-1 ring-olive-200">
      <p className="text-xs font-semibold text-mabe-900">
        Dokument zur Fallakte hochladen
        <span className="ml-1.5 font-normal text-olive-500">(PDF, PNG oder JPG · max. 15 MB)</span>
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          ref={dateiRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="min-w-0 flex-1 text-xs text-olive-600 file:mr-3 file:rounded-lg file:border-0 file:bg-mabe-900 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-mabe-800"
        />
        <button
          type="button"
          disabled={pending}
          onClick={hochladen}
          className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {pending ? 'Lädt hoch …' : 'Hochladen'}
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
  )
}
