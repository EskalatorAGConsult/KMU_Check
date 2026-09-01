import { describe, expect, it } from 'vitest'

import {
  formatiereIban,
  normalisiereIban,
  pruefeIban,
  pruefeSteuerId,
  pruefeSteuernummer,
  pruefeUstId,
  pruefeWzCode,
  steuerIdPruefziffer,
} from './validierung'

describe('pruefeIban (ISO 13616)', () => {
  it('akzeptiert die dokumentierte Bundesbank-Beispiel-IBAN', () => {
    expect(pruefeIban('DE89370400440532013000').ok).toBe(true)
  })

  it('akzeptiert Leerzeichen und Kleinschreibung', () => {
    expect(pruefeIban('de89 3704 0044 0532 0130 00').ok).toBe(true)
  })

  it('akzeptiert eine britische IBAN (22 Stellen)', () => {
    expect(pruefeIban('GB29NWBK60161331926819').ok).toBe(true)
  })

  it('akzeptiert eine franzoesische IBAN mit Buchstaben in der BBAN', () => {
    expect(pruefeIban('FR1420041010050500013M02606').ok).toBe(true)
  })

  it('weist eine falsche Pruefziffer zurueck (Zahlendreher)', () => {
    const r = pruefeIban('DE89370400440532013001')
    expect(r.ok).toBe(false)
    expect(r.fehler).toMatch(/Prüfziffer/)
  })

  it('weist eine falsche Laenge mit laenderspezifischem Hinweis zurueck', () => {
    const r = pruefeIban('DE8937040044053201300')
    expect(r.ok).toBe(false)
    expect(r.fehler).toMatch(/22 Stellen/)
  })

  it('weist unbekannte Laendercodes zurueck', () => {
    const r = pruefeIban('XX12370400440532013000')
    expect(r.ok).toBe(false)
    expect(r.fehler).toMatch(/Ländercode/)
  })

  it('weist Sonderzeichen und reinen Text zurueck', () => {
    expect(pruefeIban('Hallo Welt').ok).toBe(false)
    expect(pruefeIban('DE89-3704').ok).toBe(false)
  })

  it('normalisiert und formatiert fuer die Anzeige', () => {
    expect(normalisiereIban('de89 3704 0044')).toBe('DE8937040044')
    expect(formatiereIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00')
  })
})

describe('pruefeSteuerId (IdNr, ISO 7064 MOD 11,10)', () => {
  /** Baut eine gueltige IdNr aus 10 Basisziffern + berechneter Pruefziffer. */
  function gueltigeId(basis: string): string {
    return basis + String(steuerIdPruefziffer(basis))
  }

  it('akzeptiert eine selbst konsistent erzeugte IdNr', () => {
    expect(pruefeSteuerId(gueltigeId('1234567891')).ok).toBe(true)
  })

  it('akzeptiert eine IdNr mit einer dreifach vorkommenden Ziffer', () => {
    expect(pruefeSteuerId(gueltigeId('1112345678')).ok).toBe(true)
  })

  it('weist eine manipulierte Pruefziffer zurueck', () => {
    const id = gueltigeId('1234567891')
    const falsch = id.slice(0, 10) + String((Number(id[10]) + 1) % 10)
    const r = pruefeSteuerId(falsch)
    expect(r.ok).toBe(false)
    expect(r.fehler).toMatch(/Prüfziffer/)
  })

  it('weist falsche Laenge und Buchstaben zurueck', () => {
    expect(pruefeSteuerId('1234567890').ok).toBe(false)
    expect(pruefeSteuerId('123456789012').ok).toBe(false)
    expect(pruefeSteuerId('1234567890A').ok).toBe(false)
  })

  it('weist eine fuehrende Null zurueck', () => {
    expect(pruefeSteuerId(gueltigeId('0234567891')).ok).toBe(false)
  })

  it('weist Verstoesse gegen die Wiederholungsregel zurueck', () => {
    // Zwei Ziffern kommen jeweils doppelt vor.
    expect(pruefeSteuerId(gueltigeId('1122345678')).ok).toBe(false)
    // Eine Ziffer kommt viermal vor.
    expect(pruefeSteuerId(gueltigeId('1111345678')).ok).toBe(false)
  })
})

describe('pruefeUstId', () => {
  it('akzeptiert DE + 9 Ziffern (auch mit Leerzeichen/Kleinschreibung)', () => {
    expect(pruefeUstId('DE123456789').ok).toBe(true)
    expect(pruefeUstId('de 123456789').ok).toBe(true)
  })

  it('weist falsche Formate zurueck', () => {
    expect(pruefeUstId('DE12345678').ok).toBe(false)
    expect(pruefeUstId('DE1234567890').ok).toBe(false)
    expect(pruefeUstId('AT123456789').ok).toBe(false)
  })
})

describe('pruefeWzCode', () => {
  it('akzeptiert uebliche WZ-2008-Schreibweisen', () => {
    for (const ok of ['C', 'a', '28', '28.2', '28.29', '28.29.1', '28.29.12']) {
      expect(pruefeWzCode(ok).ok).toBe(true)
    }
  })

  it('weist ungueltige Codes zurueck', () => {
    for (const falsch of ['999', '2', '28.', '28.29.123', 'Z', 'abc', '28-29']) {
      expect(pruefeWzCode(falsch).ok).toBe(false)
    }
  })
})

describe('pruefeSteuernummer', () => {
  it('akzeptiert uebliche Schreibweisen', () => {
    expect(pruefeSteuernummer('123/456/78901').ok).toBe(true)
    expect(pruefeSteuernummer('12345678901').ok).toBe(true)
    expect(pruefeSteuernummer('12/345/67890 1').ok).toBe(true)
  })

  it('weist zu kurze/lange oder ungueltige Eingaben zurueck', () => {
    expect(pruefeSteuernummer('12345').ok).toBe(false)
    expect(pruefeSteuernummer('1'.repeat(14)).ok).toBe(false)
    expect(pruefeSteuernummer('ABC12345678901').ok).toBe(false)
  })
})
