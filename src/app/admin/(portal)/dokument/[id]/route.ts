import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/guards'
import { supabaseServer } from '@/lib/db/server'
import { loggeFehler } from '@/lib/fehler'
import { ladeDokumentBuffer } from '@/lib/storage/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /admin/dokument/[id] – authentifizierter Download-Proxy fuer Dokumente
 * aus dem PRIVATEN Blob-Store (die Blob-URLs selbst sind nicht oeffentlich).
 * Zugriff nur fuer Admins; die Datei wird serverseitig mit Token gestreamt.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin()

  try {
    const { data: dokument, error } = await supabaseServer()
      .from('dokumente')
      .select('id, typ, storage_path')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!dokument) return NextResponse.json({ ok: false, fehler: 'Dokument nicht gefunden.' }, { status: 404 })

    const inhalt = await ladeDokumentBuffer(dokument.storage_path as string)
    if (!inhalt) {
      return NextResponse.json(
        { ok: false, fehler: 'Datei im Storage nicht gefunden oder Storage nicht konfiguriert.' },
        { status: 404 },
      )
    }

    const dateiname = (dokument.storage_path as string).split('/').pop() ?? 'dokument.pdf'
    return new NextResponse(Buffer.from(inhalt.bytes), {
      headers: {
        'Content-Type': inhalt.contentType,
        'Content-Disposition': `inline; filename="${dateiname.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    loggeFehler('admin', e, { route: 'dokument_proxy', dokumentId: id })
    return NextResponse.json({ ok: false, fehler: 'Dokument konnte nicht geladen werden.' }, { status: 500 })
  }
}
