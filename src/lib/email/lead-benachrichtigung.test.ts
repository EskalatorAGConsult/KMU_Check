import { describe, expect, it } from 'vitest'

import { baueLeadBenachrichtigungHtml, type LeadPayload } from './lead-benachrichtigung'

/**
 * Lead-Benachrichtigung: alle Angaben muessen als kopierfähige Tabellen im
 * HTML stehen (BAFA-Portal-Übernahme), inkl. Verflechtung und Verrechnung.
 */

const PAYLOAD: LeadPayload = {
  type: 'kmu_check_lead',
  submitted_at: '2026-09-01T06:00:00.000Z',
  company: { name: 'Müller & Söhne Metallbau GmbH', fiscalYear: 2025, employees: 44, turnover: 5_000_000, balanceSheet: 2_283_812 },
  holdings: [
    {
      name: 'Walter Henrich GmbH',
      direction: 'holds_us',
      sharePct: 100,
      relationship: 'linked',
      employees: 3,
      turnover: 120_000,
      balanceSheet: 900_000,
    },
    {
      name: 'Partnerbau AG',
      direction: 'we_hold',
      sharePct: 30,
      relationship: 'partner',
      employees: 10,
      turnover: 1_000_000,
      balanceSheet: 500_000,
    },
  ],
  result: {
    category: 'small',
    categoryLabel: 'Kleines Unternehmen',
    isKmu: true,
    fundingRatePct: 45,
    own: { employees: 44, turnover: 5_000_000, balanceSheet: 2_283_812 },
    partnerContribution: { employees: 3, turnover: 300_000, balanceSheet: 150_000 },
    linkedContribution: { employees: 3, turnover: 120_000, balanceSheet: 900_000 },
    consolidated: { employees: 50, turnover: 5_420_000, balanceSheet: 3_333_812 },
  },
  lead: {
    salutation: 'Herr',
    firstName: 'Max',
    lastName: 'Müller',
    position: 'Geschäftsführer',
    email: 'max.mueller@mueller-soehne.de',
    phone: '+49 151 23456789',
    phoneCountry: 'DE',
    consent: true,
  },
  tracking: { gclid: 'abc123', utm_source: 'google' },
  server: { received_at: '2026-09-01T06:00:01.000Z', ip: '203.0.113.7', country: 'DE', city: 'Köln' },
}

describe('baueLeadBenachrichtigungHtml', () => {
  it('enthält KMU-Ergebnis, Förderquote und Unternehmensdaten', () => {
    const html = baueLeadBenachrichtigungHtml(PAYLOAD)
    expect(html).toContain('Kleines Unternehmen')
    expect(html).toContain('45 %')
    expect(html).toContain('Müller &amp; Söhne Metallbau GmbH') // escaping!
    expect(html).toContain('5.000.000')
  })

  it('listet die Verflechtung tabellarisch mit EU-Einstufung', () => {
    const html = baueLeadBenachrichtigungHtml(PAYLOAD)
    expect(html).toContain('Walter Henrich GmbH')
    expect(html).toContain('Verbunden (> 50 %')
    expect(html).toContain('Partnerbau AG')
    expect(html).toContain('Partner (25–50 %')
    expect(html).toContain('Gesellschafter (hält an uns)')
    expect(html).toContain('Beteiligung des Antragstellers (wir halten)')
  })

  it('zeigt die Verrechnungs-Herleitung inkl. konsolidierter Werte', () => {
    const html = baueLeadBenachrichtigungHtml(PAYLOAD)
    expect(html).toContain('Eigene Werte')
    expect(html).toContain('Konsolidiert')
    expect(html).toContain('50 JAE')
  })

  it('enthält Kontaktdaten, Einwilligungsstatus und Meta/Tracking', () => {
    const html = baueLeadBenachrichtigungHtml(PAYLOAD)
    expect(html).toContain('max.mueller@mueller-soehne.de')
    expect(html).toContain('erteilt')
    expect(html).toContain('203.0.113.7')
    expect(html).toContain('abc123')
  })

  it('funktioniert ohne Verflechtung und ohne Tracking/Meta', () => {
    const html = baueLeadBenachrichtigungHtml({
      ...PAYLOAD,
      holdings: [],
      tracking: null,
      server: undefined,
    })
    expect(html).toContain('Keine Beteiligungen/Gesellschafter angegeben.')
    expect(html).not.toContain('Walter Henrich')
  })
})
