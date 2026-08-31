import { NextResponse } from 'next/server'

import { requireKunde } from '@/lib/auth/guards'
import { holeVorgangDossier } from '@/lib/db/repositories/konto'
import { generiereDossier } from '@/lib/dossier/generate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /konto/vorgang/[id]/dossier – vollstaendige Datenzusammenstellung des
 * eigenen Vorgangs als PDF-Download. Zugriff nur auf eigene Vorgaenge
 * (angebot_zugriffe-Pruefung im Repository).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireKunde()

  const daten = await holeVorgangDossier(session.user.id, id)
  if (!daten) {
    return NextResponse.json(
      { ok: false, fehler: 'Vorgang nicht gefunden oder noch keine eingereichten Daten vorhanden.' },
      { status: 404 },
    )
  }

  const pdf = await generiereDossier(daten)
  const dateiname = `datenuebersicht-${daten.angebot.angebot_nr}.pdf`

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${dateiname}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
