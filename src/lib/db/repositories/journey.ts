import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

import { supabaseServer } from '@/lib/db/server'
import type { Angebot, AuditActor, JourneyFortschritt, JourneyToken } from '@/lib/db/types'

/**
 * Repositories: einzige Stelle mit DB-Zugriff auf die fachlichen Tabellen.
 * Jede Funktion ist schmal, typisiert und autorisiert ueber ihre Aufrufer
 * (Guards in den Server Actions / Server Components).
 */

// ---------- Audit (append-only) ----------

export async function audit(angebotId: string | null, actor: AuditActor, aktion: string, details?: unknown) {
  const { error } = await supabaseServer()
    .from('audit_events')
    .insert({ angebot_id: angebotId, actor, aktion, details: details ?? null })
  if (error) console.error('[audit] Schreiben fehlgeschlagen:', error.message)
}

// ---------- Token ----------

export function erzeugeKlartextToken(): string {
  return randomBytes(24).toString('base64url') // 192 Bit, URL-safe
}

export function hasheToken(klartext: string): string {
  // PostgREST-Bytea-Format ('\x' + hex); Buffer wuerde von supabase-js
  // als JSON-Objekt serialisiert und matched nie (Verifikations-Befund).
  return '\\x' + createHash('sha256').update(klartext, 'utf8').digest('hex')
}

/** Legt ein neues Journey-Token an und gibt den Klartext zurueck (nur hier sichtbar!). */
export async function erstelleJourneyToken(angebotId: string, laufzeitTage = 90): Promise<string> {
  const klartext = erzeugeKlartextToken()
  const hash = hasheToken(klartext)
  const expires = new Date(Date.now() + laufzeitTage * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabaseServer()
    .from('journey_tokens')
    .insert({ angebot_id: angebotId, token_hash: hash, expires_at: expires })
  if (error) throw new Error(`Token konnte nicht angelegt werden: ${error.message}`)
  return klartext
}

export interface TokenKontext {
  token: JourneyToken
  angebot: Angebot
}

/** Validiert einen Klartext-Token und liefert Token + Angebot (oder null). */
export async function validiereToken(klartext: string): Promise<TokenKontext | null> {
  const hash = hasheToken(klartext)
  const { data: token, error } = await supabaseServer()
    .from('journey_tokens')
    .select('*')
    .eq('token_hash', hash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle<JourneyToken>()
  if (error || !token) return null

  const { data: angebot, error: e2 } = await supabaseServer()
    .from('angebote')
    .select('*')
    .eq('id', token.angebot_id)
    .neq('status', 'widerrufen')
    .maybeSingle<Angebot>()
  if (e2 || !angebot) return null

  // Best-Effort: Nutzung protokollieren (kein kritischer Pfad)
  void supabaseServer()
    .from('journey_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', token.id)
    .then(() => undefined)

  return { token, angebot }
}

// ---------- Journey-Fortschritt (Draft) ----------

export async function holeFortschritt(angebotId: string): Promise<JourneyFortschritt | null> {
  const { data } = await supabaseServer()
    .from('journey_fortschritt')
    .select('*')
    .eq('angebot_id', angebotId)
    .maybeSingle<JourneyFortschritt>()
  return data ?? null
}

export async function speichereFortschritt(
  angebotId: string,
  schrittId: string,
  daten: Record<string, unknown>,
  aktuellerSchritt: string,
): Promise<void> {
  const db = supabaseServer()
  const vorhanden = await holeFortschritt(angebotId)
  const schritte = { ...(vorhanden?.schritte ?? {}), [schrittId]: daten }
  const { error } = await db.from('journey_fortschritt').upsert(
    { angebot_id: angebotId, schritte, aktueller_schritt: aktuellerSchritt },
    { onConflict: 'angebot_id' },
  )
  if (error) throw new Error(`Fortschritt konnte nicht gespeichert werden: ${error.message}`)
}

// ---------- Status ----------

export async function setzeAngebotStatus(angebotId: string, status: Angebot['status']): Promise<void> {
  const { error } = await supabaseServer().from('angebote').update({ status }).eq('id', angebotId)
  if (error) throw new Error(`Status konnte nicht gesetzt werden: ${error.message}`)
}
