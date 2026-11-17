import 'server-only'

import {
  FRIST_ERINNERUNG_STANDARD,
  sammleFristErinnerungen,
  type FristErinnerungsEinstellungen,
} from '@/lib/bescheid/domain'
import { holeEinstellung } from '@/lib/db/repositories/einstellungen'
import {
  listeFristKandidaten,
  vermerkeErinnerung,
} from '@/lib/db/repositories/fristen'
import { audit } from '@/lib/db/repositories/journey'
import { sendeFristErinnerungAnTeam } from '@/lib/email/notify'

/**
 * Kernfunktion des Fristen-Managements: einmal täglich (Vercel Cron) oder
 * manuell (Admin-Button) prüfen, welche Erinnerungen fällig sind, und je
 * NEUER Erinnerung (idempotent via Unique-Key) eine Team-Mail versenden.
 *
 * Best effort wie jeder Mail-Versand: ein Resend-Fehler zaehlt als
 * fehlgeschlagen, blockiert die weiteren Erinnerungen aber nicht; das
 * Vermerk-Insert erfolgt VOR dem Versand, damit ein Resend-Ausfall nicht
 * zu Spam-Wellen bei jedem Cron-Lauf führt (die Erinnerung gilt als
 * bearbeitet, der Grund steht im Audit).
 */

export const EINSTELLUNG_ZEITRAUM = 'frist_erinnerung_zeitraum_tage'
export const EINSTELLUNG_VNW = 'frist_erinnerung_vnw_tage'

/** Wirksame Einstellungen: DB-Werte (falls gesetzt und 1–180) sonst Standard. */
export async function holeFristErinnerungsEinstellungen(): Promise<{
  werte: FristErinnerungsEinstellungen
  quelle: 'datenbank' | 'standard'
}> {
  const [z, v] = await Promise.all([
    holeEinstellung(EINSTELLUNG_ZEITRAUM),
    holeEinstellung(EINSTELLUNG_VNW),
  ])
  const zahl = (raw: string | null, fallback: number): number => {
    const n = Number(raw)
    return Number.isInteger(n) && n >= 1 && n <= 180 ? n : fallback
  }
  const zeitraum = zahl(z, FRIST_ERINNERUNG_STANDARD.zeitraumEndeTage)
  const vnw = zahl(v, FRIST_ERINNERUNG_STANDARD.vnwFristTage)
  const ausDB = z !== null || v !== null
  return {
    werte: { zeitraumEndeTage: zeitraum, vnwFristTage: vnw },
    quelle: ausDB ? 'datenbank' : 'standard',
  }
}

export interface FristenLaufErgebnis {
  zeitraumErinnerungen: number
  vnwErinnerungen: number
  mailFehler: number
  hinweis: string
}

/** Ein Lauf: Kandidaten laden, Domäne entscheiden lassen, idempotent versenden. */
export async function pruefeUndErinnere(actor: 'cron' | `admin:${string}`): Promise<FristenLaufErgebnis> {
  const { werte } = await holeFristErinnerungsEinstellungen()
  const kandidaten = await listeFristKandidaten()
  const faellig = sammleFristErinnerungen(kandidaten, werte, new Date())

  let zeitraum = 0
  let vnw = 0
  let mailFehler = 0
  for (const e of faellig) {
    // Idempotenz zuerst: nur eine NEUE Zeile löst den Versand aus.
    const istNeu = await vermerkeErinnerung(e.angebotId, e.art, e.fristAm)
    if (!istNeu) continue
    const versand = await sendeFristErinnerungAnTeam({
      angebotId: e.angebotId,
      angebotNr: e.angebotNr,
      kundeFirma: e.kundeFirma,
      art: e.art,
      fristAm: e.fristAm,
      tageRest: e.tageRest,
    })
    if (e.art === 'zeitraum_ende') zeitraum += 1
    else vnw += 1
    if (!versand.ok) mailFehler += 1
    await audit(
      e.angebotId,
      actor === 'cron' ? 'system' : actor,
      'frist_erinnerung_gesendet',
      { art: e.art, frist_am: e.fristAm, tage_rest: e.tageRest, mail_ok: versand.ok, grund: versand.grund ?? null },
    )
  }

  const gesamt = zeitraum + vnw
  return {
    zeitraumErinnerungen: zeitraum,
    vnwErinnerungen: vnw,
    mailFehler,
    hinweis:
      gesamt === 0
        ? 'Keine fälligen Fristen-Erinnerungen.'
        : `${gesamt} Erinnerung(en) versendet (${zeitraum}× Durchführungszeitraum, ${vnw}× Verwendungsnachweis)` +
          (mailFehler > 0 ? `, ${mailFehler} Mailversand(s) fehlgeschlagen (Grund im Audit-Log)` : '') +
          '.',
  }
}
