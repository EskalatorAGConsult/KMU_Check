import 'server-only'

import { istUebergangErlaubt } from '@/lib/admin/status'
import { holeAngebot } from '@/lib/db/repositories/angebote'
import { audit, setzeAngebotStatus } from '@/lib/db/repositories/journey'
import { speichereRevision } from '@/lib/db/repositories/revisionen'
import type { AngebotStatus, AuditActor } from '@/lib/db/types'
import { ANGEBOT_STATUS_LABELS } from '@/lib/labels'

/**
 * Wiederverwendbarer, protokollierter Statuswechsel für den Bewilligungs-
 * prozess (Migration 25): erzwingt die Statusmaschine (status.ts), schreibt
 * eine Revision (wer/wann/alt→neu) und ein audit_event – das gleiche
 * Vertragstmuster wie aendereVorgangStatus, aber als Bibliotheksfunktion
 * für fachliche Prozesse statt als Admin-Formular-Action.
 */

export type StatuswechselErgebnis = 'vollzogen' | 'bereits' | 'gesperrt'

export interface StatuswechselZugriff {
  session: { user: { id: string } }
  rolle: 'admin' | 'kunde'
}

export async function wechsleStatusMitProtokoll(
  angebotId: string,
  ziel: AngebotStatus,
  zugriff: StatuswechselZugriff,
): Promise<StatuswechselErgebnis> {
  // Explizite Union-Bildung fuer AuditActor (Template-Literals mit Union-
  // Praefax würden ohne Kontext zu string verbreitern).
  const actor: AuditActor =
    zugriff.rolle === 'admin'
      ? `admin:${zugriff.session.user.id}`
      : `kunde:${zugriff.session.user.id}`
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return 'gesperrt'
  if (angebot.status === ziel) return 'bereits'
  if (!istUebergangErlaubt(angebot.status, ziel)) {
    await audit(angebotId, actor, 'statuswechsel_blockiert', {
      von: angebot.status,
      nach: ziel,
      grund: 'Übergang laut Statusmaschine nicht erlaubt',
    })
    return 'gesperrt'
  }
  await setzeAngebotStatus(angebotId, ziel)
  await speichereRevision(angebotId, zugriff.session.user.id, 'angebot', {
    status: { alt: angebot.status, neu: ziel },
  })
  await audit(angebotId, actor, 'status_geaendert', {
    von: angebot.status,
    nach: ziel,
    quelle: 'bescheid_prozess',
    labels: `${ANGEBOT_STATUS_LABELS[angebot.status]} → ${ANGEBOT_STATUS_LABELS[ziel]}`,
  })
  return 'vollzogen'
}
