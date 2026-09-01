import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/guards'
import { supabaseServer } from '@/lib/db/server'
import { loggeFehler } from '@/lib/fehler'
import { ladeDokumentBuffer } from '@/lib/storage/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /admin/vorgang/[id]/signatur – gezeichnete Kunden-Unterschrift aus dem
 * privaten Blob-Store (img-Quelle in der Fallakte). Nur fuer Admins.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin()

  try {
    const { data: vollmacht, error } = await supabaseServer()
      .from('vollmachten')
      .select('signatur_bild_path')
      .eq('angebot_id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const pfad = vollmacht?.signatur_bild_path as string | null | undefined
    if (!pfad) return NextResponse.json({ ok: false, fehler: 'Keine Unterschrift vorhanden.' }, { status: 404 })

    const inhalt = await ladeDokumentBuffer(pfad)
    if (!inhalt) {
      return NextResponse.json({ ok: false, fehler: 'Datei im Storage nicht gefunden.' }, { status: 404 })
    }

    return new NextResponse(Buffer.from(inhalt.bytes), {
      headers: {
        'Content-Type': inhalt.contentType,
        // Signaturbilder aendern sich nie (neue Signatur = neue URL): lang cachen
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    loggeFehler('admin', e, { route: 'signatur_proxy', angebotId: id })
    return NextResponse.json({ ok: false, fehler: 'Unterschrift konnte nicht geladen werden.' }, { status: 500 })
  }
}
