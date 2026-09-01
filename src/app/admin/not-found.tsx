import Link from 'next/link'

/** 404 im Admin-Bereich (z. B. unbekannte Kunden-E-Mail oder Vorgangs-ID). */
export default function AdminNotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-6 px-6 py-20 text-center">
      <p className="font-display text-5xl font-bold text-teal-600" aria-hidden>
        404
      </p>
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-xl font-semibold text-mabe-900 sm:text-2xl">
          Dieser Datensatz wurde nicht gefunden.
        </h1>
        <p className="text-sm/6 text-olive-600">
          Der Kunde oder Vorgang existiert nicht (mehr) – möglicherweise wurde er gelöscht oder die Adresse ist
          falsch geschrieben.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/admin/kunden"
          className="min-h-12 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-500"
        >
          Zur Kundenübersicht
        </Link>
        <Link
          href="/admin"
          className="min-h-12 rounded-xl border border-olive-300 bg-white px-6 py-3 text-sm font-semibold text-mabe-900 hover:bg-olive-50"
        >
          Alle Vorgänge
        </Link>
      </div>
    </main>
  )
}
