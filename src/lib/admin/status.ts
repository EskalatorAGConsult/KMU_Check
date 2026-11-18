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
  eingereicht: ['abgeschlossen', 'in_bearbeitung', 'widerrufen', 'bewilligt'],
  // 'abgeschlossen' = Antrag beim BAFA gestellt; danach folgt der Bewilligungs-
  //prozess (Migration 25). Ruecksprung nur als fachliche Korrektur.
  abgeschlossen: ['eingereicht', 'bewilligt', 'archiviert'],
  // Bescheid liegt bestaetigt vor: VNW einreichen oder zurueckkorrigieren
  bewilligt: ['abgeschlossen', 'vnw_eingereicht', 'archiviert', 'widerrufen'],
  // VNW eingereicht: Korrektur zurueck oder archivieren
  vnw_eingereicht: ['bewilligt', 'archiviert'],
  // Archiviert: fertiger Vorgang aus der Aktiv-Ansicht entfernt
  archiviert: ['vnw_eingereicht'],
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
