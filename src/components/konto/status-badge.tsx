import type { AngebotStatus } from '@/lib/db/types'

/** Status-Badge fuer Kundenvorgaenge (Laien-Label + Ampelfarben, server-kompatibel). */

const STATUS: Record<AngebotStatus, { label: string; cls: string }> = {
  angelegt: { label: 'Vorbereitet', cls: 'bg-olive-100 text-olive-700' },
  eingeladen: { label: 'Bereit zum Ausfüllen', cls: 'bg-sky-100 text-sky-800' },
  in_bearbeitung: { label: 'In Bearbeitung', cls: 'bg-amber-100 text-amber-800' },
  eingereicht: { label: 'Eingereicht ✓', cls: 'bg-teal-100 text-teal-800' },
  abgeschlossen: { label: 'Abgeschlossen ✓', cls: 'bg-emerald-100 text-emerald-800' },
  widerrufen: { label: 'Widerrufen', cls: 'bg-red-100 text-red-700' },
}

export function StatusBadge({ status }: { status: AngebotStatus }) {
  const s = STATUS[status] ?? STATUS.angelegt
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  )
}
