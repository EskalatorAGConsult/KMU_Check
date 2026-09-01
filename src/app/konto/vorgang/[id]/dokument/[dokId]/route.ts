import { NextResponse } from 'next/server'

import { requireKunde } from '@/lib/auth/guards'
import { supabaseServer } from '@/lib/db/server'
import { loggeFehler } from '@/lib/fehler'
import { ladeDokumentBuffer } from '@/lib/storage/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /konto/vorgang/[id]/dokument/[dokId] – Kunde laedt eigene Dokumente
 * (Systemkonzept, Vollmacht) aus dem privaten Blob-Store. Autorisierung:
 * nur eigene Vorgaenge ueber angebot_zugriffe (Datenintegritaet).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; dokId: string }> }) {
  const { id, dokId } = await params
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

    const { data: dokument } = await db
      .from('dokumente')
      .select('id, typ, storage_path')
      .eq('id', dokId)
      .eq('angebot_id', id) // Verankerung am eigenen Vorgang (kein fremder Dokument-Zugriff)
      .maybeSingle()
    if (!dokument) return NextResponse.json({ ok: false, fehler: 'Dokument nicht gefunden.' }, { status: 404 })

    const inhalt = await ladeDokumentBuffer(dokument.storage_path as string)
    if (!inhalt) {
      return NextResponse.json({ ok: false, fehler: 'Datei im Storage nicht gefunden.' }, { status: 404 })
    }

    const dateiname = (dokument.storage_path as string).split('/').pop() ?? 'dokument.pdf'
    return new NextResponse(Buffer.from(inhalt.bytes), {
      headers: {
        'Content-Type': inhalt.contentType,
        'Content-Disposition': `attachment; filename="${dateiname.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    loggeFehler('konto', e, { route: 'dokument_proxy', angebotId: id, dokumentId: dokId })
    return NextResponse.json({ ok: false, fehler: 'Dokument konnte nicht geladen werden.' }, { status: 500 })
  }
}
