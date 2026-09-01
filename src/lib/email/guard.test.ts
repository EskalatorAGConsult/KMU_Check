import { describe, expect, it } from 'vitest'

import { istTestAdresse } from './guard'

/**
 * Sicherheitsnetz: Test-/Platzhalter-Adressen duerfen NIEMALS eine echte
 * Mail ausloesen (Resend kostet Credits und landet bei fremden Postfachern).
 */

describe('istTestAdresse', () => {
  it('blockiert typische Test-Domains', () => {
    expect(istTestAdresse('max@test.de')).toBe(true)
    expect(istTestAdresse('vitest@example.invalid')).toBe(true)
    expect(istTestAdresse('vitest-einladung@example.invalid')).toBe(true)
    expect(istTestAdresse('foo@example.com')).toBe(true)
    expect(istTestAdresse('foo@mailinator.com')).toBe(true)
  })

  it('blockiert reservierte TLD-Endungen', () => {
    expect(istTestAdresse('a@firma.invalid')).toBe(true)
    expect(istTestAdresse('a@firma.test')).toBe(true)
    expect(istTestAdresse('a@firma.example')).toBe(true)
    expect(istTestAdresse('a@server.local')).toBe(true)
  })

  it('blockiert kaputte Adressen', () => {
    expect(istTestAdresse('ohne-domain@')).toBe(true)
    expect(istTestAdresse('kein-at-zeichen')).toBe(true)
    expect(istTestAdresse('')).toBe(true)
  })

  it('lässt echte Kundenadressen durch', () => {
    expect(istTestAdresse('geschaeftsfuehrer@mabe.de')).toBe(false)
    expect(istTestAdresse('Max.Mustermann@Musterfirma-GmbH.de')).toBe(false)
    expect(istTestAdresse('kontakt@test-engineering.de')).toBe(false) // „test" im Namen ist ok
  })
})
