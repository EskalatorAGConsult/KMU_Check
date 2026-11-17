import { describe, expect, it } from 'vitest'

import { fristStatus, NachweisKontext, tageBisFrist, zeitraumGueltig } from './domain'

/**
 * Domäne „Bewilligung & Verwendungsnachweis": reine Ableitungen – ohne
 * DB/Netzwerk vollständig testbar. Fixe Datumswerte statt new Date()
 * (deterministisch, keine Zeitzonenzufälle).
 */

const HEUTE = new Date('2026-11-17T10:30:00')

function tag(iso: string): Date {
  return new Date(`${iso}T10:30:00`)
}

describe('tageBisFrist', () => {
  it('zählt Tage bis zur Frist (heute = 0)', () => {
    expect(tageBisFrist('2026-11-17', HEUTE)).toBe(0)
    expect(tageBisFrist('2026-11-24', HEUTE)).toBe(7)
    expect(tageBisFrist('2026-12-17', HEUTE)).toBe(30)
  })

  it('negativ nach Ablauf (überfällig)', () => {
    expect(tageBisFrist('2026-11-10', HEUTE)).toBe(-7)
  })

  it('null bei fehlender oder ungültiger Frist', () => {
    expect(tageBisFrist(null, HEUTE)).toBeNull()
    expect(tageBisFrist(undefined, HEUTE)).toBeNull()
    expect(tageBisFrist('kaputt', HEUTE)).toBeNull()
  })
})

describe('fristStatus', () => {
  it('eingereicht schlägt alles', () => {
    expect(fristStatus('2025-01-01', HEUTE, true).status).toBe('eingereicht')
  })

  it('ungefasst ohne Frist (kein geratener Default!)', () => {
    expect(fristStatus(null, HEUTE, false)).toEqual({ status: 'ungefasst', tageRest: null })
  })

  it('knapp ab 28 Tagen Restzeit (28 selbst gilt noch als knapp)', () => {
    expect(fristStatus('2026-12-14', HEUTE, false).status).toBe('knapp') // 27 Tage
    expect(fristStatus('2026-12-15', HEUTE, false).status).toBe('knapp') // 28 Tage
    expect(fristStatus('2026-12-16', HEUTE, false).status).toBe('ok') // 29 Tage
    expect(fristStatus('2027-06-30', HEUTE, false).status).toBe('ok')
  })

  it('ueberfaellig ab Tag 0 vorbei', () => {
    expect(fristStatus('2026-11-16', HEUTE, false).status).toBe('ueberfaellig')
    expect(fristStatus('2026-11-17', HEUTE, false).status).toBe('knapp') // Frist HEUTE = letzter Tag
  })
})

describe('zeitraumGueltig', () => {
  it('leer/zulässig/ungültig', () => {
    expect(zeitraumGueltig(null, null)).toBe(true)
    expect(zeitraumGueltig('2026-01-01', null)).toBe(true)
    expect(zeitraumGueltig('2026-01-01', '2026-12-31')).toBe(true)
    expect(zeitraumGueltig('2026-12-31', '2026-01-01')).toBe(false)
  })
})

describe('NachweisKontext (OOP-Domäne)', () => {
  const BESCHEID = {
    vnw_frist_am: '2027-02-28',
    durchfuehrung_von: '2026-11-01',
    durchfuehrung_bis: '2027-01-31',
    bestaetigt_am: '2026-11-05T09:00:00Z',
    foerdersumme_eur: 12500,
  }

  it('ohne Bescheid: Stationen inaktiv, Einreichung gesperrt mit Baustein-Liste', () => {
    const k = new NachweisKontext({ bescheid: null, vnw: null, belege: [] }, HEUTE)
    expect(k.stationenAktiv).toBe(false)
    expect(k.bescheidBestaetigt).toBe(false)
    expect(k.darfEinreichen).toBe(false)
    expect(k.fehlendeBausteine).toEqual(['Zuwendungsbescheid hochladen'])
    expect(k.frist.status).toBe('ungefasst')
    expect(k.durchfuehrungszeitraum).toBeNull()
  })

  it('Bescheid vorhanden: Stationen aktiv (auch unbestätigt)', () => {
    const k = new NachweisKontext(
      { bescheid: { ...BESCHEID, bestaetigt_am: null }, vnw: null, belege: [] },
      HEUTE,
    )
    expect(k.stationenAktiv).toBe(true)
    expect(k.bescheidBestaetigt).toBe(false)
    expect(k.fehlendeBausteine).toContain('Bescheidangaben bestätigen')
    expect(k.darfEinreichen).toBe(false)
  })

  it('bestätigt + Belege: Einreichung erlaubt, Belegsumme korrekt', () => {
    const k = new NachweisKontext(
      { bescheid: BESCHEID, vnw: { status: 'in_bearbeitung', vorlagefrist_am: null }, belege: [{ betrag_eur: 8500 }, { betrag_eur: 125.5 }, { betrag_eur: null }] },
      HEUTE,
    )
    expect(k.bescheidBestaetigt).toBe(true)
    expect(k.darfEinreichen).toBe(true)
    expect(k.fehlendeBausteine).toEqual([])
    expect(k.belegSummeEur).toBeCloseTo(8625.5)
    expect(k.frist.status).toBe('ok') // 17.11. -> 28.02. = 103 Tage Restzeit
  })

  it('Frist-Ampel rechnet mit wirksamer Frist (VNW-Snapshot gewinnt)', () => {
    const k = new NachweisKontext(
      { bescheid: BESCHEID, vnw: { status: 'offen', vorlagefrist_am: '2026-12-10' }, belege: [] },
      HEUTE,
    )
    expect(k.wirksameFrist).toBe('2026-12-10') // VNW-Snapshot vor Bescheid-Frist
    expect(k.frist.status).toBe('knapp') // 23 Tage
    expect(k.frist.tageRest).toBe(23)
  })

  it('eingereichter VNW: Ampel eingereicht, Frist egal', () => {
    const k = new NachweisKontext(
      { bescheid: BESCHEID, vnw: { status: 'eingereicht', vorlagefrist_am: '2026-11-01' }, belege: [{ betrag_eur: 1 }] },
      HEUTE,
    )
    expect(k.frist.status).toBe('eingereicht')
  })

  it('Durchführungszeitraum nur vollständig', () => {
    const k = new NachweisKontext(
      { bescheid: { ...BESCHEID, durchfuehrung_bis: null }, vnw: null, belege: [] },
      HEUTE,
    )
    expect(k.durchfuehrungszeitraum).toBeNull()
    const k2 = new NachweisKontext({ bescheid: BESCHEID, vnw: null, belege: [] }, HEUTE)
    expect(k2.durchfuehrungszeitraum).toEqual({ von: '2026-11-01', bis: '2027-01-31' })
  })

  it('Zeitzonen-Robustheit: tageBisFrist ist unabhängig von der Uhrzeit', () => {
    expect(tageBisFrist('2026-11-18', new Date('2026-11-17T23:59:59'))).toBe(1)
    expect(tageBisFrist('2026-11-17', new Date('2026-11-17T00:00:01'))).toBe(0)
    expect(tageBisFrist('2026-11-17', tag('2026-11-17'))).toBe(0)
  })
})

