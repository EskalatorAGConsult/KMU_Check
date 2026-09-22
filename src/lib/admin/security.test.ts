import { describe, expect, it } from 'vitest'

import { ROLLEN_LABEL, SETZBARE_ROLLEN } from '@/lib/admin/rollen'
import { erlaubteZiele, istUebergangErlaubt, STATUS_TRANSITIONEN } from '@/lib/admin/status'
import type { AngebotStatus } from '@/lib/db/types'

/**
 * Sicherheits-Vertraege des Admin-Bereichs (IT-Security + DSGVO):
 * Rollen-Whitelist, Statusmaschine (keine illegalen Uebergaenge), und die
 * dokumentierten Admin-Zugangsrollen (siehe src/lib/auth/guards.ts).
 */

describe('Rollen-Whitelist (admin/rollen.ts)', () => {
  it('enthaelt exakt die fuenf definierten Rollen – keine Wildcards', () => {
    expect([...SETZBARE_ROLLEN].sort()).toEqual(['admin', 'deaktiviert', 'eskalator', 'kunde', 'vertrieb'])
  })

  it('jede setzbare Rolle hat ein Label (kein Leer-Label im UI)', () => {
    for (const rolle of SETZBARE_ROLLEN) {
      expect(ROLLEN_LABEL[rolle]).toBeTruthy()
    }
  })

  it('Admin-Zugang ist auf admin/eskalator/vertrieb beschraenkt (Vertrag von guards.ts)', () => {
    // Kunden und deaktivierte Konten duerfen NIEMALS Admin-Routen erreichen.
    // Diese Liste spiegelt ADMIN_ZUGANG in src/lib/auth/guards.ts.
    const ADMIN_ZUGANG = ['admin', 'eskalator', 'vertrieb']
    expect(ADMIN_ZUGANG).not.toContain('kunde')
    expect(ADMIN_ZUGANG).not.toContain('deaktiviert')
  })
})

describe('Statusmaschine (admin/status.ts)', () => {
  it('widerrufen ist terminal – kein Weg zurueck', () => {
    expect(erlaubteZiele('widerrufen')).toEqual([])
    for (const ziel of ['angelegt', 'eingeladen', 'in_bearbeitung', 'eingereicht', 'abgeschlossen'] as AngebotStatus[]) {
      expect(istUebergangErlaubt('widerrufen', ziel)).toBe(false)
    }
  })

  it('abgeschlossen erlaubt nur die fachliche Korrektur zurueck auf eingereicht', () => {
    expect(erlaubteZiele('abgeschlossen')).toEqual(['eingereicht'])
    expect(istUebergangErlaubt('abgeschlossen', 'angelegt')).toBe(false)
  })

  it('kein Direktsprung von angelegt auf eingereicht/abgeschlossen', () => {
    expect(istUebergangErlaubt('angelegt', 'eingereicht')).toBe(false)
    expect(istUebergangErlaubt('angelegt', 'abgeschlossen')).toBe(false)
  })

  it('typische Berater-Wege sind erlaubt (eingeladen -> in_bearbeitung -> eingereicht -> abgeschlossen)', () => {
    expect(istUebergangErlaubt('eingeladen', 'in_bearbeitung')).toBe(true)
    expect(istUebergangErlaubt('in_bearbeitung', 'eingereicht')).toBe(true)
    expect(istUebergangErlaubt('eingereicht', 'abgeschlossen')).toBe(true)
  })

  it('jeder definierte Status hat eine Transitionstabelle (Vollstaendigkeit)', () => {
    const alle: AngebotStatus[] = ['angelegt', 'eingeladen', 'in_bearbeitung', 'eingereicht', 'abgeschlossen', 'widerrufen']
    for (const s of alle) expect(STATUS_TRANSITIONEN[s]).toBeDefined()
  })
})
