'use client'

import { useRef, useState, useTransition } from 'react'

import {
  ladeSystemkonzeptHoch,
  waehleSystemkonzeptVorlage,
  type SystemkonzeptVorlage,
} from '@/lib/admin/systemkonzept-actions'

/**
 * Systemkonzept-Aktionen pro Vorgang (BAFA Modul 3, „Systemkonzept mit
 * Datenerfassungsplan"): eigenes PDF hochladen ODER Standard-Vorlage aus
 * dem Blob-Ordner vorlagen/systemkonzept/ zuordnen. Ersetzt ein evtl.
 * automatisch generiertes Dokument.
 */
export function SystemkonzeptAktionen({
  angebotId,
  aktuelleUrl,
  vorlagen,
}: {
  angebotId: string
  aktuelleUrl: string | null
  vorlagen: SystemkonzeptVorlage[]
}) {
  const dateiInput = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(aktuelleUrl)
  const [vorlage, setVorlage] = useState('')
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const ausfuehren = (
    aktion: () => Promise<{ ok: true; hinweis: string } | { ok: false; fehler: string }>,
    neueUrl?: string,
  ) => {
    setMeldung(null)
    startTransition(async () => {
      const res = await aktion()
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis } : { art: 'fehler', text: res.fehler })
      if (res.ok && neueUrl) setUrl(neueUrl)
    })
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-olive-200 bg-olive-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-olive-600 uppercase">
          Systemkonzept (Datenerfassungsplan)
        </p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-teal-700 hover:underline"
          >
            Aktuelles PDF ansehen ↗
          </a>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            wird bei Einreichung automatisch generiert
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={dateiInput}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const fd = new FormData()
            fd.set('datei', f)
            ausfuehren(() => ladeSystemkonzeptHoch(angebotId, fd))
            e.target.value = ''
          }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => dateiInput.current?.click()}
          className="rounded-lg bg-mabe-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-mabe-800 disabled:opacity-50"
        >
          Eigenes PDF hochladen
        </button>

        {vorlagen.length > 0 && (
          <>
            <select
              value={vorlage}
              onChange={(e) => setVorlage(e.target.value)}
              className="rounded-lg border border-olive-300 bg-white px-3 py-2 text-xs text-mabe-900 focus:border-teal-600 focus:outline-none"
              aria-label="Standard-Systemkonzept wählen"
            >
              <option value="">Standard-Vorlage wählen …</option>
              {vorlagen.map((v) => (
                <option key={v.url} value={v.url}>
                  {v.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending || !vorlage}
              onClick={() => ausfuehren(() => waehleSystemkonzeptVorlage(angebotId, vorlage), vorlage)}
              className="rounded-lg border border-teal-600 bg-white px-3.5 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
            >
              Zuordnen
            </button>
          </>
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
