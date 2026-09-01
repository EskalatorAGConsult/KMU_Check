import Link from 'next/link'

/** Globale 404-Seite (markenkonsistent, mit klaren Wegen zurueck). */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="font-display text-6xl font-bold text-teal-600 sm:text-7xl" aria-hidden>
        404
      </p>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-2xl font-semibold text-balance text-mabe-900 sm:text-3xl">
          Diese Seite wurde nicht gefunden.
        </h1>
        <p className="text-sm/6 text-olive-600 sm:text-base/7">
          Die Adresse ist falsch oder die Seite wurde verschoben. Prüfen Sie den Link – oder starten Sie von vorn.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="min-h-12 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-500"
        >
          Zur Startseite
        </Link>
        <Link
          href="/#kmu-check"
          className="min-h-12 rounded-xl border border-olive-300 bg-white px-6 py-3 text-sm font-semibold text-mabe-900 transition-colors hover:bg-olive-50"
        >
          Zum KMU-Check
        </Link>
      </div>
    </main>
  )
}
