/**
 * Rollen-Labels und setzbare Rollen – geteiltes Modul ohne 'use server'/
 * 'server-only', damit Server UND Client Components es importieren koennen.
 */
export const ROLLEN_LABEL: Record<string, string> = {
  admin: 'Administrator (MABE)',
  eskalator: 'Administrator (Eskalator AG)',
  vertrieb: 'Vertrieb (MABE)',
  kunde: 'Kunde',
  deaktiviert: 'Deaktiviert',
}

export const SETZBARE_ROLLEN = ['admin', 'eskalator', 'vertrieb', 'kunde', 'deaktiviert'] as const
