'use server'

import { headers } from 'next/headers'

import { audit } from '@/lib/db/repositories/journey'
import { rateLimit } from '@/lib/rate-limit'

import { sucheUnternehmen } from './client'
import { analysiereVerbundKette, mapTreffer, type RegisterTreffer, type VerbundErgebnis } from './mapping'
import { istGueltigeRegisterId, ladeVerbundGraph } from './verbund-loader'

/**
 * Oeffentliche Server Actions fuer die Handelsregister-Suche auf der
 * Landingpage (KMU-Schnellcheck ohne Journey-Token).
 *
 * Missbrauchsschutz: striktes In-Memory-Rate-Limit pro IP (die API kostet
 * Credits je Abfrage). Der OpenRegister-Key verlaesst niemals den Server.
 * Audit mit actor 'system' und ohne Vorgangsbezug (angebot_id = null).
 */

const LIMIT_SUCHE_PRO_STDUNDE = 20
const LIMIT_VERBUND_PRO_STDUNDE = 6

async function clientIp(): Promise<string> {
  const hdrs = await headers()
  return hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unbekannt'
}

export type SucheErgebnisOeffentlich =
  | { ok: true; treffer: RegisterTreffer[] }
  | { ok: false; fehler: string }

export async function openregisterSucheOeffentlich(query: string): Promise<SucheErgebnisOeffentlich> {
  const q = query.trim()
  if (q.length < 3) return { ok: false, fehler: 'Bitte mindestens 3 Zeichen eingeben.' }
  const ip = await clientIp()
  if (!rateLimit(`ors:${ip}`, LIMIT_SUCHE_PRO_STDUNDE, 60 * 60 * 1000)) {
    return { ok: false, fehler: 'Zu viele Anfragen – bitte versuchen Sie es in einer Stunde erneut.' }
  }
  try {
    const treffer = mapTreffer(await sucheUnternehmen(q))
    return { ok: true, treffer }
  } catch (e) {
    console.error('[openregister/oeffentlich] Suche fehlgeschlagen:', e)
    return { ok: false, fehler: 'Die Registersuche ist gerade nicht erreichbar. Bitte tragen Sie die Daten von Hand ein.' }
  }
}

export type VerbundAntwortOeffentlich =
  | { ok: true; ergebnis: VerbundErgebnis }
  | { ok: false; fehler: string }

export async function openregisterVerbundOeffentlich(companyId: string): Promise<VerbundAntwortOeffentlich> {
  if (!istGueltigeRegisterId(companyId)) return { ok: false, fehler: 'Ungültige Register-ID.' }
  const ip = await clientIp()
  if (!rateLimit(`orv:${ip}`, LIMIT_VERBUND_PRO_STDUNDE, 60 * 60 * 1000)) {
    return { ok: false, fehler: 'Zu viele Anfragen – bitte versuchen Sie es in einer Stunde erneut.' }
  }
  try {
    const { graph, abgeschnitten } = await ladeVerbundGraph(companyId)
    if (!graph[companyId]?.details) {
      return { ok: false, fehler: 'Das Unternehmen konnte im Handelsregister nicht geladen werden.' }
    }
    const finale = analysiereVerbundKette(graph, companyId)
    const ergebnis: VerbundErgebnis = {
      ...finale.ergebnis,
      ketteAbgeschnitten: abgeschnitten || finale.abgeschnitten,
    }
    try {
      await audit(null, 'system', 'openregister_abfrage_landingpage', {
        company_id: companyId,
        beteiligungen: ergebnis.beteiligungen.length,
        firmen_geladen: Object.keys(graph).length,
        kette_abgeschnitten: ergebnis.ketteAbgeschnitten,
      })
    } catch (e) {
      console.error('[openregister/oeffentlich] Audit fehlgeschlagen:', e)
    }
    return { ok: true, ergebnis }
  } catch (e) {
    console.error('[openregister/oeffentlich] Verbund fehlgeschlagen:', e)
    return { ok: false, fehler: 'Die Registerabfrage ist gerade nicht erreichbar. Bitte tragen Sie die Daten von Hand ein.' }
  }
}
