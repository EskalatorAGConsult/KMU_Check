import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

import { supabaseServer } from '@/lib/db/server'

/**
 * Benutzer-Repository (Userverwaltung): Benutzer lesen/verwalten und
 * Einladungslinks erzeugen/validieren. Aufrufer der Verwaltungsfunktionen
 * muessen requireAdmin() durchlaufen haben; die Token-Validierung beim
 * Annehmen einer Einladung ist oeffentlich (der Link IST das Geheimnis).
 */

export type AdminRolle = 'admin' | 'eskalator' | 'vertrieb'
export const ADMIN_ROLLEN: AdminRolle[] = ['admin', 'eskalator', 'vertrieb']

export interface Benutzer {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
}

export async function listeBenutzer(): Promise<Benutzer[]> {
  const { data, error } = await supabaseServer()
    .from('user')
    .select('id, name, email, role, "createdAt"')
    .order('createdAt', { ascending: false })
    .limit(500)
  if (error) throw new Error(`Benutzer konnten nicht geladen werden: ${error.message}`)
  return (data ?? []) as Benutzer[]
}

export async function setzeBenutzerRolle(userId: string, rolle: string): Promise<void> {
  const { error } = await supabaseServer().from('user').update({ role: rolle }).eq('id', userId)
  if (error) throw new Error(`Rolle konnte nicht geändert werden: ${error.message}`)
}

export async function existiertBenutzer(email: string): Promise<boolean> {
  const { data } = await supabaseServer().from('user').select('id').ilike('email', email).maybeSingle()
  return !!data
}

// ---------- Einladungen ----------

export interface BenutzerEinladung {
  id: string
  email: string
  rolle: AdminRolle
  expires_at: string
  used_at: string | null
  revoked_at: string | null
  created_at: string
}

export async function listeEinladungen(): Promise<BenutzerEinladung[]> {
  const { data, error } = await supabaseServer()
    .from('benutzer_einladungen')
    .select('id, email, rolle, expires_at, used_at, revoked_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`Einladungen konnten nicht geladen werden: ${error.message}`)
  return (data ?? []) as BenutzerEinladung[]
}

function hasheEinladungsToken(klartext: string): string {
  // PostgREST-Bytea-Format (gleiches Muster wie Journey-Token)
  return '\\x' + createHash('sha256').update(klartext, 'utf8').digest('hex')
}

/** Legt eine Einladung an und gibt den Klartext-Link-Token zurueck (nur hier sichtbar!). */
export async function erstelleEinladung(
  email: string,
  rolle: AdminRolle,
  eingeladenVon: string,
  laufzeitTage = 14,
): Promise<string> {
  const klartext = randomBytes(24).toString('base64url')
  const expires = new Date(Date.now() + laufzeitTage * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabaseServer().from('benutzer_einladungen').insert({
    email: email.toLowerCase(),
    rolle,
    token_hash: hasheEinladungsToken(klartext),
    expires_at: expires,
    eingeladen_von: eingeladenVon,
  })
  if (error) throw new Error(`Einladung konnte nicht angelegt werden: ${error.message}`)
  return klartext
}

/** Validiert einen Klartext-Token und liefert die Einladung (oder null). */
export async function validiereEinladungsToken(klartext: string): Promise<BenutzerEinladung | null> {
  const { data, error } = await supabaseServer()
    .from('benutzer_einladungen')
    .select('id, email, rolle, expires_at, used_at, revoked_at, created_at')
    .eq('token_hash', hasheEinladungsToken(klartext))
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error || !data) return null
  return data as BenutzerEinladung
}

export async function markiereEinladungVerwendet(id: string): Promise<void> {
  await supabaseServer().from('benutzer_einladungen').update({ used_at: new Date().toISOString() }).eq('id', id)
}

export async function widerrufeEinladung(id: string): Promise<void> {
  const { error } = await supabaseServer()
    .from('benutzer_einladungen')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Einladung konnte nicht widerrufen werden: ${error.message}`)
}
