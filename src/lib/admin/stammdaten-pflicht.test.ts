import { describe, expect, it } from 'vitest'

import { fehlendeStammdatenPflichtfelder } from './stammdaten-pflicht'

/** Pflichtfeld-Pruefung fuer die Admin-Erstanlage von Stammdaten. */

const vollstaendig: Record<string, unknown> = {
  unternehmensname: 'Müller GmbH',
  land: 'Deutschland',
  plz: '08060',
  ort: 'Zwickau',
  strasse: 'Industriestraße 12',
  email: 'info@example.de',
  wz_code: '25.11',
  unternehmensart: 'eigenstaendig',
  personenart: 'juristisch',
  steuernummer: '123/456/78901',
  gruppenzugehoerigkeit: 'privat',
  vorsteuerabzug: true,
  wirtschaftlich_taetig: true,
}

describe('fehlendeStammdatenPflichtfelder', () => {
  it('vollstaendige Eingabe -> keine fehlenden Felder', () => {
    expect(fehlendeStammdatenPflichtfelder(vollstaendig)).toEqual([])
  })

  it('leere Eingabe -> alle Pflichtfelder mit deutschen Labels', () => {
    const fehlend = fehlendeStammdatenPflichtfelder({})
    expect(fehlend.length).toBe(12)
    expect(fehlend).toContain('Unternehmensname')
    expect(fehlend).toContain('WZ-Code')
    expect(fehlend).toContain('Vorsteuerabzug')
  })

  it('Leerstrings und Boolean-false korrekt behandelt', () => {
    // Leerstring zaehlt als fehlend …
    expect(fehlendeStammdatenPflichtfelder({ ...vollstaendig, plz: '  ' })).toEqual(['PLZ'])
    // … false ist aber ein gueltiger Boolean-Wert (nicht „fehlend")
    expect(fehlendeStammdatenPflichtfelder({ ...vollstaendig, vorsteuerabzug: false })).toEqual([])
  })

  it('bedingte Pflicht: juristisch ohne Steuernummer -> DB-CHECK vorab melden', () => {
    expect(fehlendeStammdatenPflichtfelder({ ...vollstaendig, steuernummer: '' })).toEqual(['Steuernummer'])
  })

  it('bedingte Pflicht: natuerlich braucht Geburtsdatum + Steuer-ID', () => {
    const ergebnis = fehlendeStammdatenPflichtfelder({
      ...vollstaendig,
      personenart: 'natuerlich',
      steuernummer: undefined,
    })
    expect(ergebnis).toEqual(['Geburtsdatum', 'Steuer-ID'])
  })

  it('bedingte Pflicht: natuerlich vollstaendig -> keine fehlenden Felder', () => {
    expect(
      fehlendeStammdatenPflichtfelder({
        ...vollstaendig,
        personenart: 'natuerlich',
        steuernummer: undefined,
        geburtsdatum: '1980-01-31',
        steuer_id: '26954371827',
      }),
    ).toEqual([])
  })
})
