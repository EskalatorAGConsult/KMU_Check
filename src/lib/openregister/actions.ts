'use server'

import { supabaseServer } from '@/lib/db/server'
import { audit, validiereToken } from '@/lib/db/repositories/journey'

import { holeDetails, holeHoldings, holeOwners, sucheUnternehmen } from './client'
import {
  analysiereVerbundKette,
  KETTEN_LIMITS,
  mapTreffer,
  type RegisterTreffer,
  type Rohdaten,
  type VerbundErgebnis,
} from './mapping'

/**
 * Server Actions fuer die Handelsregister-Abfrage in der Kunden-Journey.
 * Autorisierung wie alle Journey-Actions ueber den Journey-Token –
 * der OpenRegister-Key verlaesst niemals den Server.
 *
 * Die Verbundabfrage durchsucht die Beteiligungskette REKURSIV ueber
 * beliebig viele Stufen (EU 2003/361/EG: verbundene Unternehmen > 50 %
 * wirken transitiv; Partner 25–50 % nur direkt, aber deren verbundene
 * Unternehmen zaehlen wieder voll). Sicherheitslimits: max. 20 Unternehmen,
 * max. 8 Stufen (KETTEN_LIMITS) – danach wird als abgeschnitten markiert.
 *
 * Kostenbewusst: Suche 1 Credit, Rohdaten je Unternehmen ~30 Credits
 * (Details + Owners + Holdings). Jede Firmen-Rohdate wird 30 Tage in
 * `openregister_cache` gecacht – Folgeabfragen und Ketten-Ueberschneidungen
 * zwischen Vorgaengen kosten dann nichts.
 */

const CACHE_TAGE = 30

export type SucheErgebnis =
  | { ok: true; treffer: RegisterTreffer[] }
  | { ok: false; fehler: string }

export async function openregisterSuche(klartextToken: string, query: string): Promise<SucheErgebnis> {
  const kontext = await validiereToken(klartextToken)
  if (!kontext) return { ok: false, fehler: 'Der Link ist ungültig oder abgelaufen.' }
  const treffer = mapTreffer(await sucheUnternehmen(query))
  return { ok: true, treffer }
}

export type VerbundAntwort =
  | { ok: true; ergebnis: VerbundErgebnis; ausCache: boolean }
  | { ok: false; fehler: string }

const ID_MUSTER = /^[A-Z]{2}-[A-Z0-9_-]+$/i

/** Rohdaten einer Firma: erst 30-Tage-Cache, sonst API (Details+Owners+Holdings parallel). */
async function ladeRohdaten(
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

export async function openregisterVerbund(
  klartextToken: string,
  companyId: string,
): Promise<VerbundAntwort> {
  const kontext = await validiereToken(klartextToken)
  if (!kontext) return { ok: false, fehler: 'Der Link ist ungültig oder abgelaufen.' }
  if (!ID_MUSTER.test(companyId)) return { ok: false, fehler: 'Ungültige Register-ID.' }

  const db = supabaseServer()
  const graph: Record<string, Rohdaten> = {}
  let applicantAusCache = false
  let abgeschnitten = false

  // BFS-Treiber: analysieren -> fehlende Firmen nachladen -> erneut analysieren.
  // Terminiert, weil geladene Firmen (auch leere) im Graph landen.
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

  if (!graph[companyId]?.details) {
    return { ok: false, fehler: 'Das Unternehmen konnte im Handelsregister nicht geladen werden.' }
  }

  const finale = analysiereVerbundKette(graph, companyId)
  const ergebnis: VerbundErgebnis = { ...finale.ergebnis, ketteAbgeschnitten: abgeschnitten || finale.abgeschnitten }

  try {
    await audit(kontext.angebot.id, `kunde:${kontext.token.id}`, 'openregister_abfrage', {
      company_id: companyId,
      beteiligungen: ergebnis.beteiligungen.length,
      max_stufe: ergebnis.beteiligungen.reduce((m, b) => Math.max(m, b.stufe), 0),
      firmen_geladen: Object.keys(graph).length,
      kette_abgeschnitten: ergebnis.ketteAbgeschnitten,
    })
  } catch (e) {
    console.error('[openregister] Audit fehlgeschlagen:', e)
  }

  return { ok: true, ergebnis, ausCache: applicantAusCache }
}
