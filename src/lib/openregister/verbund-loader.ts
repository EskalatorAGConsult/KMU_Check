import { supabaseServer } from '@/lib/db/server'

import { holeDetails, holeHoldings, holeOwners } from './client'
import { analysiereVerbundKette, KETTEN_LIMITS, type Rohdaten } from './mapping'

/**
 * Geteilter Lade-Treiber fuer die OpenRegister-Kettenverfolgung.
 * Kein 'use server' – wird von den (token-geschuetzten) Journey-Actions
 * und den (ratenlimitierten) oeffentlichen Actions gemeinsam genutzt.
 *
 * Kostenbewusst: Jede Firmen-Rohdate wird 30 Tage in `openregister_cache`
 * gecacht – Folgeabfragen und Ketten-Ueberschneidungen zwischen
 * Vorgaengen kosten dann keine API-Credits.
 */

const CACHE_TAGE = 30

const ID_MUSTER = /^[A-Z]{2}-[A-Z0-9_-]+$/i

export function istGueltigeRegisterId(companyId: string): boolean {
  return ID_MUSTER.test(companyId)
}

/** Rohdaten einer Firma: erst 30-Tage-Cache, sonst API (Details+Owners+Holdings parallel). */
export async function ladeRohdaten(
  db: ReturnType<typeof supabaseServer>,
  companyId: string,
): Promise<{ roh: Rohdaten; ausCache: boolean }> {
  const { data: cacheRow } = await db
    .from('openregister_cache')
    .select('payload, abgerufen_at')
    .eq('company_id', companyId)
    .maybeSingle()
  if (cacheRow?.abgerufen_at) {
    const alterMs = Date.now() - new Date(cacheRow.abgerufen_at).getTime()
    if (alterMs < CACHE_TAGE * 24 * 60 * 60 * 1000) {
      return { roh: cacheRow.payload as Rohdaten, ausCache: true }
    }
  }

  const [details, owners, holdings] = await Promise.all([
    holeDetails(companyId),
    holeOwners(companyId),
    holeHoldings(companyId),
  ])
  // Firma nicht abrufbar -> leere Rohdaten (bricht die Kette an dieser Stelle sauber ab)
  const roh: Rohdaten = details ? { details, owners, holdings } : { details: null, owners: null, holdings: null }
  try {
    await db.from('openregister_cache').upsert(
      { company_id: companyId, payload: roh, abgerufen_at: new Date().toISOString() },
      { onConflict: 'company_id' },
    )
  } catch (e) {
    console.error('[openregister] Cache-Schreiben fehlgeschlagen:', e)
  }
  return { roh, ausCache: false }
}

export interface VerbundGraph {
  graph: Record<string, Rohdaten>
  /** true, wenn Sicherheitslimits die Kette abgeschnitten haben. */
  abgeschnitten: boolean
  applicantAusCache: boolean
}

/**
 * BFS-Treiber ueber die Beteiligungskette: analysieren -> fehlende Firmen
 * nachladen -> erneut analysieren. Terminiert, weil geladene Firmen (auch
 * leere) im Graph landen. Sicherheitslimits in KETTEN_LIMITS.
 */
export async function ladeVerbundGraph(companyId: string): Promise<VerbundGraph> {
  const db = supabaseServer()
  const graph: Record<string, Rohdaten> = {}
  let applicantAusCache = false
  let abgeschnitten = false

  for (let runde = 0; runde <= KETTEN_LIMITS.maxStufe + 1; runde++) {
    const analyse = analysiereVerbundKette(graph, companyId)
    const ladbar = analyse.fehlendeIds
      .filter((id) => ID_MUSTER.test(id))
      .slice(0, Math.max(0, KETTEN_LIMITS.maxUnternehmen - Object.keys(graph).length))
    if (ladbar.length === 0) {
      abgeschnitten = analyse.abgeschnitten || analyse.fehlendeIds.length > 0
      break
    }
    const geladen = await Promise.all(ladbar.map((id) => ladeRohdaten(db, id)))
    ladbar.forEach((id, i) => {
      graph[id] = geladen[i].roh
      if (id === companyId) applicantAusCache = geladen[i].ausCache
    })
  }

  return { graph, abgeschnitten, applicantAusCache }
}
