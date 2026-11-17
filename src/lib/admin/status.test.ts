import { describe, expect, it } from 'vitest'

import { erlaubteZiele, istUebergangErlaubt, STATUS_TRANSITIONEN } from './status'
import type { AngebotStatus } from '@/lib/db/types'

/**
 * Statusmaschine inkl. der Bewilligungs-Stationen (Migration 25):
 * erlaubte/neue Übergänge, terminale Zustände und Vollständigkeit der Map.
 */

describe('STATUS_TRANSITIONEN (Bewilligungsprozess)', () => {
  it('Map deckt jeden Status ab (TS erzwingt, Test dokumentiert)', () => {
    const alle: AngebotStatus[] = [
      'angelegt', 'eingeladen', 'in_bearbeitung', 'eingereicht',
      'abgeschlossen', 'bewilligt', 'vnw_eingereicht', 'widerrufen',
    ]
    for (const s of alle) expect(STATUS_TRANSITIONEN[s]).toBeDefined()
  })

  it('klassischer Weg bis zum Antrag', () => {
    expect(istUebergangErlaubt('angelegt', 'eingeladen')).toBe(true)
    expect(istUebergangErlaubt('eingeladen', 'in_bearbeitung')).toBe(true)
    expect(istUebergangErlaubt('in_bearbeitung', 'eingereicht')).toBe(true)
    expect(istUebergangErlaubt('eingereicht', 'abgeschlossen')).toBe(true)
  })

  it('Bewilligung: abgeschlossen → bewilligt (der neue Normalweg)', () => {
    expect(istUebergangErlaubt('abgeschlossen', 'bewilligt')).toBe(true)
    expect(istUebergangErlaubt('eingereicht', 'bewilligt')).toBe(true) // Bescheid vor Statuspflege
  })

  it('Verwendungsnachweis: bewilligt → vnw_eingereicht, Korrektur zurück', () => {
    expect(istUebergangErlaubt('bewilligt', 'vnw_eingereicht')).toBe(true)
    expect(istUebergangErlaubt('vnw_eingereicht', 'bewilligt')).toBe(true) // BAFA fordert nach
  })

  it('Unsinnige Übergänge bleiben gesperrt', () => {
    expect(istUebergangErlaubt('angelegt', 'bewilligt')).toBe(false)
    expect(istUebergangErlaubt('angelegt', 'vnw_eingereicht')).toBe(false)
    expect(istUebergangErlaubt('in_bearbeitung', 'bewilligt')).toBe(false)
    expect(istUebergangErlaubt('bewilligt', 'angelegt')).toBe(false)
    expect(istUebergangErlaubt('vnw_eingereicht', 'abgeschlossen')).toBe(false)
    expect(istUebergangErlaubt('vnw_eingereicht', 'eingereicht')).toBe(false)
  })

  it('widerrufen bleibt terminal', () => {
    expect(erlaubteZiele('widerrufen')).toEqual([])
    expect(istUebergangErlaubt('widerrufen', 'bewilligt')).toBe(false)
  })

  it('Korrekturen zurück bleiben möglich (Nachreichung)', () => {
    expect(istUebergangErlaubt('eingereicht', 'in_bearbeitung')).toBe(true)
    expect(istUebergangErlaubt('abgeschlossen', 'eingereicht')).toBe(true)
    expect(istUebergangErlaubt('bewilligt', 'abgeschlossen')).toBe(true)
  })
})
