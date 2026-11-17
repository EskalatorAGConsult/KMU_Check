import 'server-only'

import { supabaseServer } from '@/lib/db/server'
import type { FristKandidat } from '@/lib/bescheid/domain'

/**
 * Fristen-Erinnerungen (Migration 26): Kandidaten-Lese und idempotentes
 * Versand-Vermerken. Aufrufer: die Kernfunktion pruefeUndErinnere
 * (src/lib/bescheid/fristen.ts) – Admin-guards oder Cron-Secret dort.
 */

/** Alle Vorgänge mit Bescheid (Kandidaten für Erinnerungen), nicht widerrufen. */
export async function listeFristKandidaten(): Promise<FristKandidat[]> {
  const { data, error } = await supabaseServer()
    .from('bescheide')
    .select(
      'angebot_id, angebote!inner(angebot_nr, kunde_firma, status), durchfuehrung_bis, vnw_frist_am, ' +
        'verwendungsnachweise(vorlagefrist_am, status)',
    )
    .neq('angebote.status', 'widerrufen')
  if (error) throw new Error(`Frist-Kandidaten konnten nicht geladen werden: ${error.message}`)
  return (data ?? []).map((r) => {
    const zeile = r as unknown as {
      angebot_id: string
      angebote: { angebot_nr: string; kunde_firma: string }
      durchfuehrung_bis: string | null
      vnw_frist_am: string | null
      verwendungsnachweise: { vorlagefrist_am: string | null; status: string } | null
    }
    const vnw = zeile.verwendungsnachweise
    return {
      angebotId: zeile.angebot_id,
      angebotNr: zeile.angebote.angebot_nr,
      kundeFirma: zeile.angebote.kunde_firma,
      durchfuehrungBis: zeile.durchfuehrung_bis,
      vnwFrist: zeile.vnw_frist_am,
      vnwVorlagefrist: vnw?.vorlagefrist_am ?? null,
      vnwEingereicht: vnw?.status === 'eingereicht',
    }
  })
}

/**
 * Vermerkt eine Erinnerung als versendet – IDEMPOTENT über den Unique-Key
 * (angebot, art, frist_am). Liefert true nur bei NEUER Zeile (der Aufrufer
 * versendet die Mail ausschließlich dann; ON CONFLICT DO NOTHING ist race-sicher).
 */
export async function vermerkeErinnerung(
  angebotId: string,
  art: 'zeitraum_ende' | 'vnw_frist',
  fristAm: string,
): Promise<boolean> {
  const { data, error } = await supabaseServer()
    .from('frist_erinnerungen')
    .insert({ angebot_id: angebotId, art, frist_am: fristAm })
    .select('id')
    .maybeSingle()
  if (error) throw new Error(`Erinnerung konnte nicht vermerkt werden: ${error.message}`)
  return !!data
}

/** Anzahl versendeter Erinnerungen je Art (Einstellungs-Seite/Vorschau). */
export async function zaehleErinnerungen(): Promise<{ zeitraum: number; vnw: number }> {
  const db = supabaseServer()
  const [z, v] = await Promise.all([
    db.from('frist_erinnerungen').select('id', { count: 'exact', head: true }).eq('art', 'zeitraum_ende'),
    db.from('frist_erinnerungen').select('id', { count: 'exact', head: true }).eq('art', 'vnw_frist'),
  ])
  return { zeitraum: z.count ?? 0, vnw: v.count ?? 0 }
}
