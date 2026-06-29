import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

/**
 * Dezenter „Druckluftbehälter“-/Maschinenbau-Hintergrund im Blueprint-Stil:
 * technisches Raster, Druckbehälter-Silhouetten und Maßlinien in MABE-Tönen.
 * Bewusst sehr zurückhaltend, damit der weiße High-End-Look und die Lesbarkeit
 * (WCAG-Kontrast der Schrift) erhalten bleiben.
 */
export function HeroBackground({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div aria-hidden="true" className={clsx('pointer-events-none absolute inset-0 overflow-hidden', className)} {...props}>
      {/* weiche Lichtverläufe */}
      <div className="absolute -top-40 -right-40 size-[40rem] rounded-full bg-teal-400/10 blur-3xl" />
      <div className="absolute -bottom-48 -left-40 size-[40rem] rounded-full bg-mabe-500/10 blur-3xl" />

      {/* Blueprint-Raster */}
      <svg className="absolute inset-0 size-full text-mabe-900/[0.04]" aria-hidden="true">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Druckbehälter-Silhouette rechts */}
      <svg
        viewBox="0 0 240 420"
        fill="none"
        className="absolute top-1/2 right-[-3rem] hidden h-[34rem] -translate-y-1/2 text-mabe-700/[0.07] lg:block xl:right-12"
        aria-hidden="true"
      >
        <rect x="60" y="40" width="120" height="340" rx="60" stroke="currentColor" strokeWidth="2" />
        <ellipse cx="120" cy="100" rx="60" ry="22" stroke="currentColor" strokeWidth="2" />
        <ellipse cx="120" cy="320" rx="60" ry="22" stroke="currentColor" strokeWidth="2" />
        <rect x="108" y="14" width="24" height="26" rx="4" stroke="currentColor" strokeWidth="2" />
        <line x1="40" y1="40" x2="40" y2="380" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
        <line x1="36" y1="40" x2="44" y2="40" stroke="currentColor" strokeWidth="1.5" />
        <line x1="36" y1="380" x2="44" y2="380" stroke="currentColor" strokeWidth="1.5" />
        <line x1="60" y1="210" x2="180" y2="210" stroke="currentColor" strokeWidth="1" strokeDasharray="3 5" />
        <circle cx="120" cy="210" r="14" stroke="currentColor" strokeWidth="2" />
        <path d="M120 196v28M106 210h28" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  )
}
