import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/guards'
import { holeVorgang } from '@/lib/db/repositories/kunden'
import { generiereFallaktePdf } from '@/lib/dossier/fallakte'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /admin/vorgang/[id]/fallakte – vollstaendige Fallakte eines Vorgangs als
 * PDF-Download (BAFA-Reihenfolge, inkl. Verbundrechnung und Audit-Report der
 * Admin-Korrekturen). Zugriff nur fuer Admins (MABE/Eskalator).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin()

  const vorgang = await holeVorgang(id)
  if (!vorgang) {
    return NextResponse.json({ ok: false, fehler: 'Vorgang nicht gefunden.' }, { status: 404 })
  }

  const pdf = await generiereFallaktePdf(vorgang)
  const dateiname = `fallakte-${vorgang.angebot.angebot_nr.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${dateiname}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
