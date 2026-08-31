'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Barrierefreies Info-Tooltip (ⓘ) fuer Fachbegriffe.
 * - Touch: Tippen oeffnet/schließt; Klick/Tap daneben oder Escape schließt.
 * - Desktop: zusätzlich Hover (nur bei Maus, nicht bei Touch-Sticks).
 * - positioniert sich mobil am linken Rand des Labels, ab sm zentriert –
 *   bleibt dadurch innerhalb des Viewports (keine Overflows).
 */
export function Tooltip({ text, label }: { text: string; label?: string }) {
  const [offen, setOffen] = useState(false)
  const wurzel = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!offen) return
    const beiKlickDaneben = (e: MouseEvent | TouchEvent) => {
      if (wurzel.current && !wurzel.current.contains(e.target as Node)) setOffen(false)
    }
    const beiEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false)
    }
    document.addEventListener('mousedown', beiKlickDaneben)
    document.addEventListener('touchstart', beiKlickDaneben)
    document.addEventListener('keydown', beiEscape)
    return () => {
      document.removeEventListener('mousedown', beiKlickDaneben)
      document.removeEventListener('touchstart', beiKlickDaneben)
      document.removeEventListener('keydown', beiEscape)
    }
  }, [offen])

  return (
    <span ref={wurzel} className="relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        aria-label={label ?? 'Erläuterung anzeigen'}
        aria-expanded={offen}
        onClick={() => setOffen((o) => !o)}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setOffen(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setOffen(false)}
        className="ml-1.5 inline-flex size-5 items-center justify-center rounded-full text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4.5" aria-hidden>
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {offen && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-40 mb-2 w-64 max-w-[calc(100vw-3rem)] rounded-xl bg-mabe-900 px-4 py-3 text-left text-xs/5 font-normal whitespace-normal text-white shadow-xl ring-1 ring-black/10 sm:left-1/2 sm:-translate-x-1/2"
        >
          {text}
          <span
            aria-hidden
            className="absolute top-full left-4 size-2.5 -translate-y-1/2 rotate-45 bg-mabe-900 sm:left-1/2 sm:-translate-x-1/2"
          />
        </span>
      )}
    </span>
  )
}
