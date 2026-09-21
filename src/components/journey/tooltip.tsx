'use client'

import { useEffect, useRef, useState } from 'react'

/** Wohin der Tooltip klappt – wird beim Oeffnen aus der Trigger-Position gemessen. */
type Klappe = 'links' | 'mitte' | 'rechts'

/** Halbe Tooltip-Breite (w-64 = 16rem) + Luft fuer die Ausrichtungsmessung. */
const HALF = 128
const RAND = 16

/**
 * Barrierefreies Info-Tooltip (ⓘ) fuer Fachbegriffe.
 * - Touch: Tippen oeffnet/schließt; Klick/Tap daneben oder Escape schließt.
 * - Desktop: zusätzlich Hover (nur bei Maus, nicht bei Touch-Sticks).
 * - Position wird beim Oeffnen am Trigger gemessen (getBoundingClientRect):
 *   zentriert, wenn links und rechts Platz ist, sonst am jeweiligen Rand
 *   ausgerichtet – bleibt dadurch IMMER im Viewport (Mobile-Audit: der
 *   256px-Tooltip wurde am rechten Rand zuvor von overflow-clip gekappt).
 */
export function Tooltip({ text, label }: { text: string; label?: string }) {
  const [offen, setOffen] = useState(false)
  const [klappe, setKlappe] = useState<Klappe>('mitte')
  const wurzel = useRef<HTMLSpanElement>(null)

  /** Ausrichtung anhand der Trigger-Position bestimmen (viewport-geklemmt). */
  const ermittleKlappe = () => {
    const rect = wurzel.current?.getBoundingClientRect()
    if (!rect) return
    const mitteOk = rect.left - HALF >= RAND && rect.right + HALF <= window.innerWidth - RAND
    if (mitteOk) setKlappe('mitte')
    else if (rect.right + 2 * HALF > window.innerWidth - RAND) setKlappe('rechts')
    else setKlappe('links')
  }

  const oeffne = (o: boolean) => {
    if (o) ermittleKlappe()
    setOffen(o)
  }

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

  const klappeCls: Record<Klappe, string> = {
    links: 'left-0',
    mitte: 'left-1/2 -translate-x-1/2',
    rechts: 'right-0',
  }
  const pfeilCls: Record<Klappe, string> = {
    links: 'left-4',
    mitte: 'left-1/2 -translate-x-1/2',
    rechts: 'right-4',
  }

  return (
    <span ref={wurzel} className="relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        aria-label={label ?? 'Erläuterung anzeigen'}
        aria-expanded={offen}
        onClick={() => oeffne(!offen)}
        onPointerEnter={(e) => e.pointerType === 'mouse' && oeffne(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setOffen(false)}
        className="ml-1.5 inline-flex size-5 items-center justify-center rounded-full text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4.5" aria-hidden>
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 0 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {offen && (
        <span
          role="tooltip"
          className={`absolute bottom-full z-40 mb-2 w-64 max-w-[calc(100vw-3rem)] rounded-xl bg-mabe-900 px-4 py-3 text-left text-xs/5 font-normal whitespace-normal text-white shadow-xl ring-1 ring-black/10 ${klappeCls[klappe]}`}
        >
          {text}
          <span
            aria-hidden
            className={`absolute top-full size-2.5 -translate-y-1/2 rotate-45 bg-mabe-900 ${pfeilCls[klappe]}`}
          />
        </span>
      )}
    </span>
  )
}
