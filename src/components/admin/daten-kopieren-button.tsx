'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Kopiert den kompletten BAFA-Datenauszug eines Vorgangs in die
 * Zwischenablage (Klartext, in der Reihenfolge des BAFA-Formulars).
 * Fallback ohne Clipboard-API: sichtbares Textarea + manuell kopieren.
 */
export function DatenKopierenButton({ text }: { text: string }) {
  const [zustand, setZustand] = useState<'bereit' | 'kopiert' | 'fehler'>('bereit')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setZustand('kopiert')
    } catch {
      // Fallback fuer Browser ohne Clipboard-API/Berechtigung
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setZustand('kopiert')
      } catch {
        setZustand('fehler')
      }
    }
    timer.current = setTimeout(() => setZustand('bereit'), 3000)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={kopieren}
        className="rounded-lg bg-mabe-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-mabe-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
      >
        {zustand === 'kopiert' ? '✓ Kopiert' : 'Alle Antragsdaten kopieren'}
      </button>
      {zustand === 'fehler' && (
        <span role="alert" className="text-xs font-medium text-red-700">
          Kopieren fehlgeschlagen – bitte die Tabelle unten markieren.
        </span>
      )}
    </div>
  )
}
