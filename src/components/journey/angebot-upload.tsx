'use client'

import { useRef, useState } from 'react'

import { ladeAngebotHoch } from '@/lib/journey/actions'

/**
 * Optionaler Angebot-Upload im Uebersichtsschritt (Journey-Anfang): Der Kunde
 * kann sein Angebots-PDF hinterlegen. Es wird im privaten Blob archiviert
 * (dokumente typ 'angebot_pdf'), erscheint spaeter im Kunden-Konto und in der
 * Admin-Fallakte und liegt der Eingangsbestaetigungsmail als Anhang bei.
 */
export function AngebotUpload({
  token,
  bereitsHochgeladen,
}: {
  /** Journey-Token (Autorisierung der Server Action). */
  token: string
  /** true, wenn bereits ein Angebot hochgeladen wurde (Erneut-Erstellen anbieten). */
  bereitsHochgeladen: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [hochgeladen, setHochgeladen] = useState(bereitsHochgeladen)
  const [laeuft, setLaeuft] = useState(false)

  const sende = async (datei: File) => {
    setLaeuft(true)
    setMeldung(null)
    try {
      const fd = new FormData()
      fd.append('datei', datei)
      const res = await ladeAngebotHoch(token, fd)
      if (res.ok) {
        setHochgeladen(true)
        setMeldung({ art: 'ok', text: 'Angebot erhalten – es wird Ihren Unterlagen beigefügt.' })
      } else {
        setMeldung({ art: 'fehler', text: res.fehler })
      }
    } catch {
      setMeldung({ art: 'fehler', text: 'Der Upload ist fehlgeschlagen. Bitte erneut versuchen.' })
    } finally {
      setLaeuft(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-olive-200 bg-white p-5">
      <p className="text-sm font-semibold text-mabe-900">
        {hochgeladen ? 'Ihr Angebots-PDF' : 'Angebot als PDF hinterlegen'}{' '}
        <span className="font-normal text-olive-400">(optional)</span>
      </p>
      <p className="mt-1 text-xs/5 text-olive-600">
        {hochgeladen
          ? 'Vielen Dank – Ihr Angebot liegt in Ihren Vorgangsunterlagen und wird Ihrer Bestätigungsmail als Anhang beigefügt.'
          : 'Sie haben Ihr Angebot noch als PDF zur Hand? Dann hinterlegen Sie es hier – es wird sicher verwahrt, Ihrer Bestätigungsmail beigefügt und Ihrem Berater zur Verfügung gestellt.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void sende(f)
          }}
        />
        <button
          type="button"
          disabled={laeuft}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border border-teal-600/50 px-4 py-2.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-50"
        >
          {laeuft ? 'Wird hochgeladen …' : hochgeladen ? 'Anderes Angebot hochladen' : 'Angebots-PDF auswählen'}
        </button>
        {hochgeladen && !laeuft && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-600/20">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden>
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
            hinterlegt
          </span>
        )}
      </div>
      {meldung && (
        <p
          role="status"
          className={`mt-2 text-xs/5 font-medium ${meldung.art === 'ok' ? 'text-teal-700' : 'text-red-700'}`}
        >
          {meldung.text}
        </p>
      )}
    </div>
  )
}
