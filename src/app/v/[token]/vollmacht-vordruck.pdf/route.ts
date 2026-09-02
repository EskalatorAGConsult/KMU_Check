import { NextResponse } from 'next/server'

import { holeFortschritt, validiereToken } from '@/lib/db/repositories/journey'
import { loggeFehler } from '@/lib/fehler'
import { fuelleVollmachtAus } from '@/lib/vollmacht/fuelle-vollmacht'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /v/[token]/vollmacht-vordruck.pdf – die BAFA-Vollmacht (eew_vm_3),
 * bereits mit den Stammdaten aus dem Journey-Entwurf vorbefuellt, aber OHNE
 * Datum und Unterschrift – fuer den Weg „haendisch unterschreiben"
 * (Download -> Drucken -> Unterschreiben -> Scannen -> Hochladen).
 * Der persoenliche Link (Token) ist die Zugriffsberechtigung.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const kontext = await validiereToken(token)
  if (!kontext) {
    return NextResponse.json({ ok: false, fehler: 'Der Link ist ungültig oder abgelaufen.' }, { status: 404 })
  }
  // ?inline=1: Anzeige im eingebetteten Viewer (iframe) statt Download-Dialog
  const inline = new URL(req.url).searchParams.get('inline') === '1'

  try {
    // Stammdaten aus dem Entwurf (muss noch nicht eingereicht sein);
    // Fallbacks: Firmenname aus dem Angebot, Rest bleibt frei.
    const fortschritt = await holeFortschritt(kontext.angebot.id)
    const unternehmen = (fortschritt?.schritte?.['unternehmen'] ?? {}) as Record<string, unknown>
    const s = (k: string) => (typeof unternehmen[k] === 'string' ? (unternehmen[k] as string) : '')

    const pdf = await fuelleVollmachtAus({
      unternehmensname: s('unternehmensname') || kontext.angebot.kunde_firma,
      strasse: s('strasse'),
      plz: s('plz'),
      ort: s('ort'),
      vorgangsnummer: kontext.angebot.angebot_nr,
      vordruck: true,
    })

    const dateiname = `vollmacht-vordruck-${kontext.angebot.angebot_nr.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${dateiname}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    loggeFehler('journey', e, { route: 'vollmacht_vordruck' })
    return NextResponse.json(
      { ok: false, fehler: 'Der Vordruck konnte nicht erstellt werden. Bitte erneut versuchen.' },
      { status: 500 },
    )
  }
}
