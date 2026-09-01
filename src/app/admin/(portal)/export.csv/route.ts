import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/auth/guards'
import { baueCsv, type CsvWert } from '@/lib/csv'
import { supabaseServer } from '@/lib/db/server'
import { loggeFehler } from '@/lib/fehler'
import { ANGEBOT_STATUS_LABELS, TECHNOLOGIE_LABELS } from '@/lib/labels'
import { CATEGORY_LABELS } from '@/lib/kmu'
import type { Angebot, AngebotStatus, KmuBewertungRow, Technologie } from '@/lib/db/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /admin/export.csv – alle Vorgaenge als CSV (Excel-DE: Semikolon, BOM).
 * Enthaelt die Kernfelder der Pipeline inkl. aktueller KMU-Kategorie,
 * Foerderquote und voraussichtlichem Zuschuss. Nur fuer Admins.
 */
export async function GET() {
  await requireAdmin()
  const db = supabaseServer()

  try {
    const { data: angebote, error } = await db
      .from('angebote')
      .select('*')
      .order('created_at', { ascending: false })
      // Begrenzung bewusst dokumentiert: Der Export ist fuer die operative
      // Pflege gedacht, nicht fuer Massenexporte – stiller Abbruch ab 10 000.
      .limit(10_000)
    if (error) throw new Error(error.message)

  const alle = (angebote ?? []) as Angebot[]
  const ids = alle.map((a) => a.id)

  // Juengste KMU-Bewertung je Vorgang (fuer Kategorie/Quote/Zuschuss)
  const kmuNachAngebot = new Map<string, KmuBewertungRow>()
  if (ids.length > 0) {
    const { data: kmu } = await db
      .from('kmu_bewertungen')
      .select('*')
      .in('angebot_id', ids)
      .order('geschaeftsjahr', { ascending: false })
    for (const k of (kmu ?? []) as KmuBewertungRow[]) {
      if (!kmuNachAngebot.has(k.angebot_id)) kmuNachAngebot.set(k.angebot_id, k)
    }
  }

  const kopf = [
    'Angebotsnummer',
    'Status',
    'Kundenfirma',
    'Kunden-E-Mail',
    'Ansprechpartner (Vertrieb)',
    'Angebotsdatum',
    'Technologien',
    'Investition gesamt (EUR)',
    'KMU-Kategorie',
    'Förderquote (%)',
    'Vorauss. Zuschuss (EUR)',
    'Angelegt am',
  ]

  const zeilen: CsvWert[][] = alle.map((a) => {
    const kmu = kmuNachAngebot.get(a.id)
    const invest = (a.invest_software ?? 0) + (a.invest_messtechnik ?? 0) + (a.invest_steuerung ?? 0)
    const zuschuss = kmu?.foerderquote_pct != null ? (invest * kmu.foerderquote_pct) / 100 : null
    return [
      a.angebot_nr,
      ANGEBOT_STATUS_LABELS[a.status as AngebotStatus] ?? a.status,
      a.kunde_firma,
      a.kunde_email,
      a.kunde_ansprechpartner,
      a.angebot_datum,
      a.technologien.map((t: Technologie) => TECHNOLOGIE_LABELS[t]).join(', '),
      invest || null,
      kmu?.kategorie ? (CATEGORY_LABELS[kmu.kategorie] ?? kmu.kategorie) : null,
      kmu?.foerderquote_pct ?? null,
      zuschuss != null ? Math.round(zuschuss * 100) / 100 : null,
      a.created_at?.slice(0, 10) ?? null,
    ]
  })

    const csv = baueCsv(kopf, zeilen)
    const datum = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vorgaenge-${datum}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    loggeFehler('admin', e, { route: 'export_csv' })
    return NextResponse.json(
      { ok: false, fehler: 'Der CSV-Export konnte nicht erstellt werden. Bitte erneut versuchen.' },
      { status: 500 },
    )
  }
}
