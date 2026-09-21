import { describe, expect, it } from 'vitest'

import { WZ2008, istWzCodeBekannt, wzCodeBezeichnung } from './wz2008'

/**
 * Offizielle WZ-2008-Liste (Destatis): Umfang, Integritaet und Lookup-Vertrag.
 * Die Daten stammen aus der amtlichen Gliederung (scripts/build_wz2008.py).
 */
describe('WZ2008 (offizielle Destatis-Liste)', () => {
  it('hat den amtlichen Umfang: 21 Abschnitte, Hunderte Klassen/Unterklassen', () => {
    const codes = Object.keys(WZ2008)
    expect(codes.length).toBeGreaterThan(1800)
    expect(codes.filter((c) => c.length === 1).length).toBe(21) // Abschnitte A–U
  })

  it('loest bekannte Codes auf (amtliche Bezeichnung)', () => {
    expect(wzCodeBezeichnung('28.29.0')).toContain('Herstellung von sonstigen nicht wirtschaftszweigspezifischen Maschinen')
    expect(wzCodeBezeichnung('C')).toBe('Verarbeitendes Gewerbe')
    expect(wzCodeBezeichnung('28')).toBe('Maschinenbau')
  })

  it('ist tolerant bei Kleinschreibung und Leerzeichen', () => {
    expect(wzCodeBezeichnung(' c ')).toBe('Verarbeitendes Gewerbe')
  })

  it('unbekannte Codes liefern null (weicher Hinweis, kein Fehler)', () => {
    expect(wzCodeBezeichnung('99.99.9')).toBeNull()
    expect(istWzCodeBekannt('99.99.9')).toBe(false)
    expect(istWzCodeBekannt('28.29')).toBe(true)
  })
})
