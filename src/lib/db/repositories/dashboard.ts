import 'server-only'

import { supabaseServer } from '@/lib/db/server'
import { zaehleUeberfaelligeWiedervorlagen } from '@/lib/db/repositories/notizen'
import type { AngebotStatus } from '@/lib/db/types'

/**
 * Dashboard-Kennzahlen des Admin-Arbeitsplatzes (KPI-Kacheln).
 * Vertrag: Aggregationen laufen ueber maximal 1000 Vorgaenge in JS
 * (Mengengeruest des Portals); „offen" = nicht abgeschlossen/widerrufen.
 */

export interface DashboardKennzahlen {
  vorgaengeGesamt: number
  offen: number
  proStatus: Record<AngebotStatus, number>
  /** Offene Vorgaenge ohne Kunden-Aufruf in den letzten 7 Tagen (Nachfass-Liste). */
  ohneZugriffUeber7Tage: number
  /** Ueberfaellige Wiedervorlagen offener Vorgaenge (Migration 21). */
  ueberfaelligeWiedervorlagen: number
  /** Investitionssumme offener Vorgaenge (Pipeline). */
  pipelineInvestEur: number
  /** Voraussichtlicher Zuschuss der Pipeline (aktuelle Foerderquote je Vorgang). */
  pipelineZuschussEur: number
}

interface AngebotKpi {
  id: string
  status: AngebotStatus
  invest_software: number | null
  invest_messtechnik: number | null
  invest_steuerung: number | null
}

export async function ladeDashboardKennzahlen(): Promise<DashboardKennzahlen> {
  const db = supabaseServer()
  const { data: angebote, error } = await db
    .from('angebote')
    .select('id, status, invest_software, invest_messtechnik, invest_steuerung')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw new Error(`Kennzahlen konnten nicht geladen werden: ${error.message}`)

  const alle = (angebote ?? []) as AngebotKpi[]
  const offene = alle.filter((a) => a.status !== 'abgeschlossen' && a.status !== 'widerrufen')
  const offeneIds = offene.map((a) => a.id)

  const proStatus: Record<AngebotStatus, number> = {
    angelegt: 0,
    eingeladen: 0,
    in_bearbeitung: 0,
    eingereicht: 0,
    abgeschlossen: 0,
    widerrufen: 0,
  }
  for (const a of alle) proStatus[a.status] += 1

  // Kunden-Aufrufe der letzten 7 Tage (Migration 20) – Nachfass-Liste in JS
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let ohneZugriffUeber7Tage = 0
  if (offeneIds.length > 0) {
    const { data: zugriffe } = await db
      .from('kunden_zugriffe')
      .select('angebot_id')
      .in('angebot_id', offeneIds)
      .gt('created_at', cutoff)
    const aktiv = new Set((zugriffe ?? []).map((z) => z.angebot_id as string))
    ohneZugriffUeber7Tage = offeneIds.filter((id) => !aktiv.has(id)).length
  }

  // Aktuelle Foerderquote je offenem Vorgang (juengstes Geschaeftsjahr zuerst)
  const quoteNachAngebot = new Map<string, number>()
  if (offeneIds.length > 0) {
    const { data: kmu } = await db
      .from('kmu_bewertungen')
      .select('angebot_id, foerderquote_pct')
      .in('angebot_id', offeneIds)
      .order('geschaeftsjahr', { ascending: false })
    for (const k of kmu ?? []) {
      const id = k.angebot_id as string
      if (!quoteNachAngebot.has(id) && k.foerderquote_pct != null) {
        quoteNachAngebot.set(id, k.foerderquote_pct as number)
      }
    }
  }

  let pipelineInvestEur = 0
  let pipelineZuschussEur = 0
  for (const a of offene) {
    const invest = (a.invest_software ?? 0) + (a.invest_messtechnik ?? 0) + (a.invest_steuerung ?? 0)
    pipelineInvestEur += invest
    const quote = quoteNachAngebot.get(a.id)
    if (quote != null) pipelineZuschussEur += (invest * quote) / 100
  }

  const heuteIso = new Date().toISOString().slice(0, 10)
  const ueberfaelligeWiedervorlagen = await zaehleUeberfaelligeWiedervorlagen(offeneIds, heuteIso)

  return {
    vorgaengeGesamt: alle.length,
    offen: offene.length,
    proStatus,
    ohneZugriffUeber7Tage,
    ueberfaelligeWiedervorlagen,
    pipelineInvestEur,
    pipelineZuschussEur,
  }
}
