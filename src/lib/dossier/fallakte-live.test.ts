import { describe, expect, it } from 'vitest'

import { supabaseServer } from '@/lib/db/server'
import { holeVorgang } from '@/lib/db/repositories/kunden'
import { generiereFallaktePdf } from './fallakte'

/**
 * LIVE-Reproduktion: rendert die Fallakte fuer JEDEN echten Vorgang der
 * Datenbank (Produktions-Fehler vom 01.09.2026: „Fallakte konnte nicht
 * erstellt werden"). Findet datengetriebene Abstuerze, die Fixtures nicht
 * abdecken. Laeuft nur mit DB-Zugriff (.env.local via test/setup-env.ts).
 */
describe('Fallakte gegen echte Vorgaenge (Live-Repro)', () => {
  it('rendert jeden Vorgang fehlerfrei als PDF', async () => {
    const { data: angebote, error } = await supabaseServer().from('angebote').select('id, angebot_nr')
    if (error) throw new Error(error.message)
    expect(angebote!.length).toBeGreaterThan(0)

    const fehler: string[] = []
    for (const a of angebote!) {
      try {
        const vorgang = await holeVorgang(a.id as string)
        if (!vorgang) {
          fehler.push(`${a.angebot_nr}: holeVorgang lieferte null`)
          continue
        }
        const bytes = await generiereFallaktePdf(vorgang)
        if (bytes.length < 500) fehler.push(`${a.angebot_nr}: PDF verdächtig klein (${bytes.length} Bytes)`)
      } catch (e) {
        fehler.push(`${a.angebot_nr}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    expect(fehler).toEqual([])
  }, 120_000)
})
