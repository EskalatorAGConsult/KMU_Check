import { describe, expect, it } from 'vitest'

import { schemaFuerSchritt } from './schemas'
import { schrittNach } from './schritte'
import { steuerIdPruefziffer } from '@/lib/validierung'

/**
 * Integration: Die echten Felddefinitionen (schritte.ts) werden gegen die
 * zentralen Pruefverfahren (validierung.ts) gefahren – client- und
 * serverseitig identisch, inkl. Sichtbarkeitslogik (sichtbarWenn).
 */

const GUELTIGE_IBAN = 'DE89 3704 0044 0532 0130 00' // dokumentiertes Bundesbank-Beispiel

function pflichtfelder(schrittId: string): Record<string, unknown> {
  const schritt = schrittNach(schrittId)!
  const daten: Record<string, unknown> = {}
  for (const feld of schritt.felder ?? []) {
    if (!feld.pflicht || feld.sichtbarWenn) continue
    switch (feld.typ) {
      case 'email':
        daten[feld.name] = 'muster@example.org'
        break
      case 'plz':
        daten[feld.name] = '45468'
        break
      case 'auswahl':
        daten[feld.name] = feld.optionen?.[0]?.wert ?? 'x'
        break
      case 'iban':
        daten[feld.name] = GUELTIGE_IBAN
        break
      case 'wz_code':
        daten[feld.name] = '28.29'
        break
      default:
        daten[feld.name] = 'Muster'
    }
  }
  return daten
}

describe('Schritt „antrag" – IBAN-Validierung', () => {
  const schema = schemaFuerSchritt(schrittNach('antrag')!)

  it('akzeptiert eine gueltige IBAN mit Pruefziffer', () => {
    const res = schema.safeParse(pflichtfelder('antrag'))
    expect(res.success).toBe(true)
  })

  it('weist eine IBAN mit falscher Pruefziffer verstaendlich zurueck', () => {
    const res = schema.safeParse({ ...pflichtfelder('antrag'), iban: 'DE89 3704 0044 0532 0130 01' })
    expect(res.success).toBe(false)
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'iban')
      expect(issue?.message).toMatch(/Prüfziffer/)
    }
  })

  it('weist eine IBAN falscher Laenge mit Stellenhinweis zurueck', () => {
    const res = schema.safeParse({ ...pflichtfelder('antrag'), iban: 'DE893704' })
    expect(res.success).toBe(false)
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'iban')
      expect(issue?.message).toMatch(/22 Stellen/)
    }
  })
})

describe('Schritt „unternehmen" – bedingte Steuer-Felder', () => {
  const schema = schemaFuerSchritt(schrittNach('unternehmen')!)

  const basis = { ...pflichtfelder('unternehmen'), land: 'Deutschland', personenart: 'juristisch' }

  it('juristische Person: Steuernummer pflicht, gueltiges Format wird akzeptiert', () => {
    const res = schema.safeParse({ ...basis, steuernummer: '123/456/78901' })
    expect(res.success).toBe(true)
  })

  it('juristische Person: ungueltige Steuernummer wird bemängelt', () => {
    const res = schema.safeParse({ ...basis, steuernummer: '12345' })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.issues.some((i) => i.path[0] === 'steuernummer')).toBe(true)
  })

  it('juristische Person: optionale USt-IdNr. wird bei Fuellung geprueft', () => {
    const ok = schema.safeParse({ ...basis, steuernummer: '123/456/78901', ust_id: 'DE123456789' })
    expect(ok.success).toBe(true)
    const falsch = schema.safeParse({ ...basis, steuernummer: '123/456/78901', ust_id: 'DE123' })
    expect(falsch.success).toBe(false)
  })

  it('natuerliche Person: Steuer-ID mit gueltiger Pruefziffer wird akzeptiert', () => {
    const id = '1234567891' + steuerIdPruefziffer('1234567891')
    const res = schema.safeParse({ ...basis, personenart: 'natuerlich', geburtsdatum: '1980-05-17', steuer_id: id })
    expect(res.success).toBe(true)
  })

  it('natuerliche Person: Steuer-ID mit falscher Pruefziffer wird bemängelt', () => {
    const res = schema.safeParse({
      ...basis,
      personenart: 'natuerlich',
      geburtsdatum: '1980-05-17',
      steuer_id: '12345678910',
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.issues.some((i) => i.path[0] === 'steuer_id')).toBe(true)
  })

  it('ausgeblendete Felder blockieren nie – selbst mit ungueltigem Restwert', () => {
    // Steuer-ID gehoert zur natuerlichen Person; bei „juristisch" ist sie
    // ausgeblendet und darf keinen Fehler erzeugen (Datenkonsistenz).
    const res = schema.safeParse({ ...basis, steuernummer: '123/456/78901', steuer_id: 'quatsch' })
    expect(res.success).toBe(true)
  })

  it('WZ-Code wird formal geprueft', () => {
    const falsch = schema.safeParse({ ...basis, steuernummer: '123/456/78901', wz_code: '999' })
    expect(falsch.success).toBe(false)
    if (!falsch.success) expect(falsch.error.issues.some((i) => i.path[0] === 'wz_code')).toBe(true)
  })

  it('Land ist fest „Deutschland“ – andere Werte werden serverseitig verworfen', () => {
    const ok = schema.safeParse({ ...basis, steuernummer: '123/456/78901' })
    expect(ok.success).toBe(true)
    const falsch = schema.safeParse({ ...basis, steuernummer: '123/456/78901', land: 'Frankreich' })
    expect(falsch.success).toBe(false)
    if (!falsch.success) expect(falsch.error.issues.some((i) => i.path[0] === 'land')).toBe(true)
  })

  it('Auswahl-Felder akzeptieren nur definierte Optionswerte', () => {
    const falsch = schema.safeParse({ ...basis, steuernummer: '123/456/78901', vorsteuerabzug: 'vielleicht' })
    expect(falsch.success).toBe(false)
    if (!falsch.success) expect(falsch.error.issues.some((i) => i.path[0] === 'vorsteuerabzug')).toBe(true)
  })
})
