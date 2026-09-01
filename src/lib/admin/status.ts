import type { AngebotStatus } from '@/lib/db/types'

/**
 * Statusmaschine der Vorgaenge (reiner Vertrag, framework-frei).
 * Definiert, welche manuellen Statuswechsel ein Admin vornehmen darf –
 * automatische Uebergaenge (z. B. Journey-Abschluss -> 'eingereicht')
 * laufen weiterhin ueber die Fachprozesse und sind hier nicht abgebildet.
 */

export const STATUS_TRANSITIONEN: Record<AngebotStatus, readonly AngebotStatus[]> = {
  angelegt: ['eingeladen', 'in_bearbeitung', 'widerrufen'],
  eingeladen: ['angelegt', 'in_bearbeitung', 'widerrufen'],
  in_bearbeitung: ['eingeladen', 'eingereicht', 'widerrufen'],
  // Korrektur zurueck in Bearbeitung ist erlaubt (z. B. Kunde reicht nach)
  eingereicht: ['abgeschlossen', 'in_bearbeitung', 'widerrufen'],
  // Abgeschlossen ist der Endzustand; nur fachliche Korrektur zurueck
  abgeschlossen: ['eingereicht'],
  // Widerrufen ist terminal (Links sind ungueltig, Daten bleiben archiviert)
  widerrufen: [],
}

/** Erlaubte Zielstatus fuer einen manuellen Wechsel. */
export function erlaubteZiele(status: AngebotStatus): readonly AngebotStatus[] {
  return STATUS_TRANSITIONEN[status]
}

export function istUebergangErlaubt(von: AngebotStatus, nach: AngebotStatus): boolean {
  return STATUS_TRANSITIONEN[von].includes(nach)
}
