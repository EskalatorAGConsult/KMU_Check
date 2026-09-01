import 'server-only'

import { supabaseServer } from '@/lib/db/server'
import type { VorgangNotizRow } from '@/lib/db/types'

/**
 * Repository fuer interne Berater-Notizen (Migration 21).
 * Alle Aufrufer muessen vorher requireAdmin() durchlaufen haben.
 * Vertrag: Text 1–2000 Zeichen, Wiedervorlage als ISO-Datum (JJJJ-MM-TT).
 */

/** Notizen mehrerer Vorgaenge, neueste zuerst (je Vorgang max. `limit`). */
export async function listeNotizen(angebotIds: string[], limit = 50): Promise<VorgangNotizRow[]> {
  if (angebotIds.length === 0) return []
  const { data, error } = await supabaseServer()
    .from('vorgang_notizen')
    .select('*')
    .in('angebot_id', angebotIds)
    .order('created_at', { ascending: false })
    .limit(angebotIds.length * limit)
  if (error) throw new Error(`Notizen konnten nicht geladen werden: ${error.message}`)
  return (data ?? []) as VorgangNotizRow[]
}

/** Fuegt eine Notiz hinzu (Validierung erfolgt in der Server Action). */
export async function fuegeNotizHinzu(
  angebotId: string,
  autor: string,
  text: string,
  wiedervorlageAm: string | null,
): Promise<VorgangNotizRow> {
  const { data, error } = await supabaseServer()
    .from('vorgang_notizen')
    .insert({ angebot_id: angebotId, autor, text, wiedervorlage_am: wiedervorlageAm })
    .select('*')
    .single<VorgangNotizRow>()
  if (error) throw new Error(`Notiz konnte nicht gespeichert werden: ${error.message}`)
  return data
}

/** Loescht eine Notiz (Admin-Korrektur; wird als audit_event protokolliert). */
export async function loescheNotiz(notizId: string, angebotId: string): Promise<void> {
  const { error } = await supabaseServer()
    .from('vorgang_notizen')
    .delete()
    .eq('id', notizId)
    .eq('angebot_id', angebotId) // zusaetzliche Verankerung am Vorgang (Mandantenkonsistenz)
  if (error) throw new Error(`Notiz konnte nicht gelöscht werden: ${error.message}`)
}

/** Zaehlt ueberfaellige Wiedervorlagen offener Vorgaenge (Dashboard-Kachel). */
export async function zaehleUeberfaelligeWiedervorlagen(offeneAngebotIds: string[], heuteIso: string): Promise<number> {
  if (offeneAngebotIds.length === 0) return 0
  const { count, error } = await supabaseServer()
    .from('vorgang_notizen')
    .select('id', { count: 'exact', head: true })
    .in('angebot_id', offeneAngebotIds)
    .lt('wiedervorlage_am', heuteIso)
  if (error) throw new Error(`Wiedervorlagen konnten nicht gezählt werden: ${error.message}`)
  return count ?? 0
}
