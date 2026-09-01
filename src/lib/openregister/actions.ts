'use server'

import { audit, validiereToken } from '@/lib/db/repositories/journey'

import { sucheUnternehmen } from './client'
import {
  analysiereVerbundKette,
  mapTreffer,
  type RegisterTreffer,
  type VerbundErgebnis,
} from './mapping'
import { istGueltigeRegisterId, ladeVerbundGraph } from './verbund-loader'

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
 * Der eigentliche Lade-/Cache-Treiber liegt in ./verbund-loader.ts und wird
 * mit den oeffentlichen Actions (Landingpage, ratenlimitiert) geteilt.
 */

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

export async function openregisterVerbund(
  klartextToken: string,
  companyId: string,
): Promise<VerbundAntwort> {
  const kontext = await validiereToken(klartextToken)
  if (!kontext) return { ok: false, fehler: 'Der Link ist ungültig oder abgelaufen.' }
  if (!istGueltigeRegisterId(companyId)) return { ok: false, fehler: 'Ungültige Register-ID.' }

  const { graph, abgeschnitten, applicantAusCache } = await ladeVerbundGraph(companyId)

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
