import { NextResponse } from 'next/server'

import { requireKunde } from '@/lib/auth/guards'
import { supabaseServer } from '@/lib/db/server'
import { loggeFehler } from '@/lib/fehler'
import { ladeDokumentBuffer } from '@/lib/storage/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /konto/vorgang/[id]/signatur – die eigene gezeichnete Unterschrift im
 * Kundenkonto (img-Quelle). Nur der verknuepfte Vorgang (angebot_zugriffe).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireKunde()

  try {
    const db = supabaseServer()
    const { data: zugriff } = await db
      .from('angebot_zugriffe')
      .select('angebot_id')
      .eq('user_id', session.user.id)
      .eq('angebot_id', id)
      .maybeSingle()
    if (!zugriff) return NextResponse.json({ ok: false, fehler: 'Kein Zugriff auf diesen Vorgang.' }, { status: 403 })

    const { data: vollmacht } = await db
      .from('vollmachten')
      .select('signatur_bild_path')
      .eq('angebot_id', id)
      .maybeSingle()
    const pfad = vollmacht?.signatur_bild_path as string | null | undefined
    if (!pfad) return NextResponse.json({ ok: false, fehler: 'Keine Unterschrift vorhanden.' }, { status: 404 })

    const inhalt = await ladeDokumentBuffer(pfad)
    if (!inhalt) {
      return NextResponse.json({ ok: false, fehler: 'Datei im Storage nicht gefunden.' }, { status: 404 })
    }

    return new NextResponse(Buffer.from(inhalt.bytes), {
      headers: { 'Content-Type': inhalt.contentType, 'Cache-Control': 'private, max-age=3600' },
    })
  } catch (e) {
    loggeFehler('konto', e, { route: 'signatur_proxy', angebotId: id })
    return NextResponse.json({ ok: false, fehler: 'Unterschrift konnte nicht geladen werden.' }, { status: 500 })
  }
}
