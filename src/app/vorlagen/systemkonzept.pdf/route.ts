import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { NextResponse } from 'next/server'

import { loggeFehler } from '@/lib/fehler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATEI = path.join(process.cwd(), 'docs', 'vorlagen', 'systemkonzept_modul3.pdf')

/**
 * GET /vorlagen/systemkonzept.pdf – das universelle MABE-Systemkonzept
 * (BAFA EEW Modul 3, Pflichtanlage „Systemkonzept mit Datenerfassungsplan").
 * Oeffentlich lesbar (Produkt-/Standarddokument, keine personenbezogenen
 * Daten), inline fuer die Einbettung im Vollmacht-Schritt der Journey.
 */
export async function GET() {
  try {
    const bytes = await readFile(DATEI)
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Systemkonzept_Modul3_MABE_SMART_CONTROL.pdf"',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e) {
    loggeFehler('vorlagen', e, { route: 'systemkonzept_pdf' })
    return NextResponse.json(
      { ok: false, fehler: 'Das Systemkonzept konnte nicht geladen werden.' },
      { status: 500 },
    )
  }
}
