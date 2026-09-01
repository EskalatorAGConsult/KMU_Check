'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Count-up-Animation fuer die grosse Erfolgs-Zahl (Reward-Moment).
 * easeOutCubic ueber ~1,2 s; bei prefers-reduced-motion sofort der Endwert.
 */
export function CountUp({
  ziel,
  format,
  dauerMs = 1200,
}: {
  ziel: number
  format: (v: number) => string
  dauerMs?: number
}) {
  const [wert, setWert] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setWert(ziel)
      return
    }
    let raf = 0
    const schritt = (t: number) => {
      if (startRef.current === null) startRef.current = t
      const p = Math.min(1, (t - startRef.current) / dauerMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setWert(ziel * eased)
      if (p < 1) raf = requestAnimationFrame(schritt)
    }
    raf = requestAnimationFrame(schritt)
    return () => cancelAnimationFrame(raf)
  }, [ziel, dauerMs])

  return <span className="tabular-nums">{format(wert)}</span>
}
