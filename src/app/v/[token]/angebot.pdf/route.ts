import { NextResponse } from 'next/server'

import { validiereToken } from '@/lib/db/repositories/journey'
import { loggeFehler } from '@/lib/fehler'
import { ladeDokumentBuffer } from '@/lib/storage/blob'
import { supabaseServer } from '@/lib/db/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /v/[token]/angebot.pdf – das vom Vertrieb beim Fall-Anlegen hochgeladene
 * MABE-Angebots-PDF als Download fuer den Kunden (Uebersichtsschritt der
 * Journey). Der persoenliche Link (Token) ist die Zugriffsberechtigung –
 * das Dokument selbst liegt privat im Blob und ist sonst nicht erreichbar.
 * Quelle: bevorzugt dokumente(typ 'angebot_pdf'), Fallback die am Angebot
 * archivierte Datei (angebot_pdf_path, aeltere Vorgaenge).
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const kontext = await validiereToken(token)
  if (!kontext) {
    return NextResponse.json({ ok: false, fehler: 'Der Link ist ungültig oder abgelaufen.' }, { status: 404 })
  }
  // ?inline=1: Anzeige im Viewer statt Download-Dialog (wie Vordruck-Route)
  const inline = new URL(req.url).searchParams.get('inline') === '1'

  try {
    const { data: doc } = await supabaseServer()
      .from('dokumente')
      .select('storage_path')
      .eq('angebot_id', kontext.angebot.id)
      .eq('typ', 'angebot_pdf')
      .limit(1)
      .maybeSingle()
    const pfad = doc?.storage_path ?? kontext.angebot.angebot_pdf_path ?? null
    if (!pfad) {
      return NextResponse.json(
        { ok: false, fehler: 'Für diesen Vorgang liegt kein Angebots-PDF vor.' },
        { status: 404 },
      )
    }
    const inhalt = await ladeDokumentBuffer(pfad)
    if (!inhalt) {
      return NextResponse.json(
        { ok: false, fehler: 'Das Angebots-PDF konnte nicht geladen werden.' },
        { status: 404 },
      )
    }

    const dateiname = `angebot-${kontext.angebot.angebot_nr.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
    return new NextResponse(Buffer.from(inhalt.bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${dateiname}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    loggeFehler('journey', e, { route: 'angebot_pdf' })
    return NextResponse.json(
      { ok: false, fehler: 'Das Angebot konnte nicht geladen werden. Bitte erneut versuchen.' },
      { status: 500 },
    )
  }
}
