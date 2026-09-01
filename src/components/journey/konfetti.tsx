'use client'

import { useMemo } from 'react'

/**
 * CSS-Konfetti (reduced-motion-sicher, kein JS-Loop, GPU-only transform).
 * Reine Belohnungs-Animation auf der Erfolgsseite – aria-hidden, blockiert
 * nichts und verschwindet nach ~3 s von selbst.
 */

const FARBEN = ['#0d9488', '#14b8a6', '#fbbf24', '#16324f', '#5eead4', '#f59e0b']

export function Konfetti({ anzahl = 28 }: { anzahl?: number }) {
  const teile = useMemo(
    () =>
      Array.from({ length: anzahl }, (_, i) => {
        // Deterministisch gestreut (kein SSR-Mismatch): Sinus-Hash je Index
        const h = (n: number) => Math.abs(Math.sin(i * 127.1 + n * 311.7))
        return {
          id: i,
          links: h(1) * 100, // %
          verzoegerung: h(2) * 0.9, // s
          breite: 6 + h(3) * 8,
          hoehe: 8 + h(4) * 10,
          farbe: FARBEN[i % FARBEN.length],
          drift: (h(5) - 0.5) * 240, // px seitlich
          spin: 220 + h(6) * 420, // deg
          rund: h(7) > 0.6,
        }
      }),
    [anzahl],
  )

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {teile.map((t) => (
        <span
          key={t.id}
          className="animate-konfetti absolute top-0 block"
          style={
            {
              left: `${t.links}%`,
              width: t.breite,
              height: t.hoehe,
              backgroundColor: t.farbe,
              borderRadius: t.rund ? '50%' : '2px',
              animationDelay: `${t.verzoegerung}s`,
              '--drift': `${t.drift}px`,
              '--spin': `${t.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
