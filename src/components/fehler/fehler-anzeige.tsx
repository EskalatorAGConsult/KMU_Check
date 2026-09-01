'use client'

/**
 * Gemeinsame, markenkonsistente Fehler-Anzeige fuer alle Error-Boundaries
 * (MABE-CI, mobil zuerst, klare naechste Schritte statt technischem Kauderwelsch).
 */
export function FehlerAnzeige({
  titel,
  text,
  kennung,
  onReset,
  homeHref = '/',
  homeLabel = 'Zur Startseite',
}: {
  titel: string
  text: string
  /** Fehlerkennung (digest) fuer Support-Rueckfragen. */
  kennung?: string
  /** „Erneut versuchen" – Next.js reset() der Boundary. */
  onReset?: () => void
  homeHref?: string
  homeLabel?: string
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-300">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-8" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </span>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-2xl font-semibold text-balance text-mabe-900 sm:text-3xl">{titel}</h1>
        <p className="text-sm/6 text-olive-600 sm:text-base/7">{text}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="min-h-12 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50"
          >
            Erneut versuchen
          </button>
        )}
        <a
          href={homeHref}
          className="min-h-12 rounded-xl border border-olive-300 bg-white px-6 py-3 text-sm font-semibold text-mabe-900 transition-colors hover:bg-olive-50"
        >
          {homeLabel}
        </a>
      </div>
      {kennung && (
        <p className="text-xs/5 text-olive-400">
          Fehlerkennung: <code className="rounded bg-olive-100 px-1.5 py-0.5 font-mono text-[11px]">{kennung}</code>
          {' '}– bitte nennen Sie diese bei Rückfragen.
        </p>
      )}
    </main>
  )
}
