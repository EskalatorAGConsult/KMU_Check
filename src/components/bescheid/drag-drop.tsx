'use client'

import { clsx } from 'clsx/lite'
import { useRef, useState } from 'react'

/**
 * Wiederverwendbare Drag-&-Drop-Upload-Zone (client): Datei per Drag oder
 * Klick auswählen, Typ/Größe clientseitig vorprüfen (Server validiert
 * trotzdem per Magic-Bytes), Übergabe an die aufrufende Action.
 * Barrierefrei: echter <input type="file"> mit Label, Fokus-Ring,
 * Tastatur-bedienbar; Statusmeldungen über role=status/alert.
 */
export function DragDropZone({
  label,
  hinweis,
  accept = '.pdf',
  maxMb = 15,
  pending = false,
  onDatei,
  kompakt = false,
}: {
  /** Beschriftung der Zone (z. B. „Zuwendungsbescheid hierher ziehen"). */
  label: string
  /** Optionaler Erklärungstext unter dem Label. */
  hinweis?: string
  /** Accept-Attribut des File-Inputs (Datei-Endungen/MIME). */
  accept?: string
  /** Client-Vorprüfung der Größe in MB (Server prüft final). */
  maxMb?: number
  /** Zeigt „Lädt hoch …" und sperrt die Zone. */
  pending?: boolean
  /** Callback mit der gewählten Datei – Aufrufer startet die Action. */
  onDatei: (datei: File) => void
  /** Schlanke Variante für Seitenpanel statt Hero-Dropzone. */
  kompakt?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragAktiv, setDragAktiv] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const pruefeUndReiche = (datei: File | undefined) => {
    if (!datei) return
    setFehler(null)
    if (datei.size > maxMb * 1024 * 1024) {
      setFehler(`Die Datei ist größer als ${maxMb} MB.`)
      return
    }
    onDatei(datei)
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => !pending && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !pending) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!pending) setDragAktiv(true)
        }}
        onDragLeave={() => setDragAktiv(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragAktiv(false)
          if (pending) return
          pruefeUndReiche(e.dataTransfer.files?.[0])
        }}
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50',
          kompakt ? 'min-h-24 px-4 py-4' : 'min-h-44 px-6 py-8',
          dragAktiv
            ? 'border-teal-600 bg-teal-50'
            : 'border-olive-300 bg-white hover:border-teal-500 hover:bg-teal-50/40',
          pending && 'pointer-events-none opacity-60',
        )}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className={clsx('text-teal-600', kompakt ? 'size-6' : 'size-9')} aria-hidden>
          <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
          <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
        </svg>
        <p className={clsx('font-semibold text-mabe-900', kompakt ? 'text-sm' : 'text-base')}>{label}</p>
        {hinweis && <p className="max-w-md text-xs/5 text-olive-500">{hinweis}</p>}
        <p className="text-[11px] font-medium tracking-wide text-teal-700 uppercase">
          {pending ? 'Lädt hoch …' : 'Datei auswählen'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            pruefeUndReiche(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {fehler && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs/5 font-medium text-red-700">
          {fehler}
        </p>
      )}
    </div>
  )
}
