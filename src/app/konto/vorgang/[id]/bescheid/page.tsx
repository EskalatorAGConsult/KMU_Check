import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BescheidManager } from '@/components/bescheid/bescheid-manager'
import { StatusBadge } from '@/components/konto/status-badge'
import { holeSession } from '@/lib/auth/guards'
import { holeBescheidBundle } from '@/lib/db/repositories/bescheid'
import { supabaseServer } from '@/lib/db/server'
import type { AngebotStatus } from '@/lib/db/types'
import type { BescheidAnalyse } from '@/lib/gemini/bescheid-analyse'

export const metadata: Metadata = { title: 'Zuwendungsbescheid | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * CLEAN-Page: Zuwendungsbescheid hochladen (Drag & Drop), OCR-Daten prüfen,
 * Durchführungszeitraum & VNW-Vorlagefrist erfassen. Zugriff: Kunde mit
 * zugeordnetem Vorgang (angebot_zugriffe) oder Admin (Support).
 */
export default async function BescheidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await holeSession()
  if (!session?.user) notFound()

  // Zugriff: eigene Zuordnung (wie alle /konto-Routen) – Admins sehen den
  // Vorgang über /admin; ein Admin hier hätte ebenfalls Zugriff, aber die
  // Kanonische Pflege läuft über die Fallakte.
  const { data: zugriff } = await supabaseServer()
    .from('angebot_zugriffe')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('angebot_id', id)
    .maybeSingle()
  if (!zugriff) notFound()

  const { data: angebot } = await supabaseServer()
    .from('angebote')
    .select('id, angebot_nr, kunde_firma, status')
    .eq('id', id)
    .maybeSingle()
  if (!angebot) notFound()

  const bundle = await holeBescheidBundle(id)
  const ocr = (bundle?.bescheid?.ocr ?? null) as BescheidAnalyse | null

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href={`/konto/vorgang/${id}`} className="text-sm font-semibold text-teal-700 hover:underline">
        ← Zurück zum Vorgang
      </Link>

      <header className="mt-4 mb-8">
                <h1 className="mt-1 min-w-0 font-display text-2xl font-semibold text-balance break-words text-mabe-900 sm:text-3xl" style={{ overflowWrap: 'break-word', minWidth: 0 }}>Zuwendungsbescheid</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm/6 text-olive-600">
          <span className="font-semibold text-mabe-900">{angebot.angebot_nr}</span>
          <span>·</span>
          <span>{angebot.kunde_firma}</span>
          <StatusBadge status={angebot.status as AngebotStatus} />
        </div>
        <p className="mt-3 max-w-xl text-sm/6 text-olive-600">
          Geschafft, das BAFA hat bewilligt? Dann wird Ihr Zuschuss jetzt Wirklichkeit. Laden Sie den
          Bescheid hoch: Wir merken uns Fristen und Auflagen und begleiten Sie bis zur Auszahlung.
        </p>
      </header>

      <BescheidManager
        angebotId={id}
        bescheid={bundle?.bescheid ?? null}
        ocrStart={ocr}
        dokumentId={bundle?.dokument?.id ?? null}
      />
    </main>
  )
}
