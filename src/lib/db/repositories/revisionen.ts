import 'server-only'

import { supabaseServer } from '@/lib/db/server'
import type { StammdatenRow, VorgangRevisionRow } from '@/lib/db/types'

/**
 * Repository fuer die Admin-Bearbeitung (Migration 19):
 * Updates auf angebote/stammdaten + append-only Revisionshistorie.
 * Alle Aufrufer muessen vorher requireAdmin() durchlaufen haben.
 */

/** Aktualisiert Angebotsfelder (bereits whitelisted + validiert). */
export async function aktualisiereAngebotFelder(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseServer()
    .from('angebote')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Angebot konnte nicht aktualisiert werden: ${error.message}`)
}

/** Aktualisiert Stammdatenfelder (1:1 zum Angebot; PK = angebot_id). */
export async function aktualisiereStammdatenFelder(angebotId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseServer()
    .from('stammdaten')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('angebot_id', angebotId)
  if (error) throw new Error(`Stammdaten konnten nicht aktualisiert werden: ${error.message}`)
}

/** Laedt die aktuellen Stammdaten (Diff-Basis); null wenn noch nicht ausgefuellt. */
export async function holeStammdaten(angebotId: string): Promise<StammdatenRow | null> {
  const { data, error } = await supabaseServer()
    .from('stammdaten')
    .select('*')
    .eq('angebot_id', angebotId)
    .maybeSingle<StammdatenRow>()
  if (error) throw new Error(`Stammdaten konnten nicht geladen werden: ${error.message}`)
  return data ?? null
}

/** Haengt eine Revision an (append-only). */
export async function speichereRevision(
  angebotId: string,
  bearbeitetVon: string,
  bereich: 'angebot' | 'stammdaten',
  aenderungen: Record<string, { alt: unknown; neu: unknown }>,
): Promise<void> {
  const { error } = await supabaseServer()
    .from('vorgang_revisionen')
    .insert({ angebot_id: angebotId, bearbeitet_von: bearbeitetVon, bereich, aenderungen })
  if (error) throw new Error(`Revision konnte nicht gespeichert werden: ${error.message}`)
}

/** Revisionshistorie eines Vorgangs, neueste zuerst. */
export async function listeRevisionen(angebotIds: string[]): Promise<VorgangRevisionRow[]> {
  if (angebotIds.length === 0) return []
  const { data, error } = await supabaseServer()
    .from('vorgang_revisionen')
    .select('*')
    .in('angebot_id', angebotIds)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(`Revisionen konnten nicht geladen werden: ${error.message}`)
  return (data ?? []) as VorgangRevisionRow[]
}
