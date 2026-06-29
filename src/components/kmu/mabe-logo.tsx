import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

/**
 * MABE SMART CONTROL wordmark, rebuilt to match the official logo:
 * a square mark split diagonally (teal upper-right / navy lower-left) with a
 * white rounded "pressure-vessel" capsule, the "MABE" wordmark in brand navy
 * and "SMART CONTROL" in steel grey beneath it.
 */
export function MabeLogo({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 232 48" fill="none" className={clsx(className)} role="img" aria-label="MABE SMART CONTROL" {...props}>
      {/* Mark */}
      <g>
        <rect x="2" y="3" width="42" height="42" rx="3" className="fill-teal-500" />
        <path d="M2 6 V42 a3 3 0 0 0 3 3 H41 Z" className="fill-mabe-900" />
        <rect x="17.5" y="11" width="11" height="26" rx="5.5" transform="rotate(-45 23 24)" className="fill-white" />
      </g>
      {/* Wordmark */}
      <text
        x="56"
        y="29"
        className="fill-mabe-900"
        style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: '28px', letterSpacing: '1px' }}
      >
        MABE
      </text>
      <text
        x="57"
        y="43"
        className="fill-olive-500"
        style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600, fontSize: '11px', letterSpacing: '4.5px' }}
      >
        SMART CONTROL
      </text>
    </svg>
  )
}
