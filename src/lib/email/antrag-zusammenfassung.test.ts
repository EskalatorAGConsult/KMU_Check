import { describe, expect, it } from 'vitest'

import { baueAntragZusammenfassungHtml, type AntragZusammenfassung } from './antrag-zusammenfassung'
import { evaluateKmu } from '@/lib/kmu'

/**
 * Antrags-Zusammenfassungs-Mail: der Kunde erhaelt nach dem Absenden alle
 * seine Angaben hochwertig formatiert – der Builder muss vollstaendig,
 * HTML-escaped und ohne undefined/null-Artefakte rendern.
 */

function beispiel(overrides: Partial<AntragZusammenfassung> = {}): AntragZusammenfassung {
  return {
    kundeFirma: 'Müller & Söhne <Metallbau> GmbH',
    angebotNr: 'ANG-2026-042',
    strasse: 'Industriestraße 12',
    plz: '08060',
    ort: 'Zwickau',
    email: 'info@mueller-soehne.de',
    wzCode: '28.29',
    ustId: 'DE123456789',
    apName: 'Max Mustermann',
    apRolle: 'Geschäftsführer',
    apEmail: 'max@mueller-soehne.de',
    kmu: evaluateKmu({
      companyName: 'Müller & Söhne Metallbau GmbH',
      employees: 30,
      turnover: 4_000_000,
      balanceSheet: 2_500_000,
      holdings: [
        { id: 'b0', name: 'Schwesterchen GmbH', sharePct: 100, employees: 10, turnover: 1_000_000, balanceSheet: 500_000 },
      ],
    }),
    geschaeftsjahr: 2025,
    kmuSchaetzung: false,
    technologien: ['Mess- und Sensortechnik', 'Energiemanagementsoftware'],
    investSumme: 55_000,
    sensorenGesamt: 36,
    projektende: '2026-12-31',
    beantragungsweg: 'eskalator',
    deminimisSumme: 0,
    ...overrides,
  }
}

describe('baueAntragZusammenfassungHtml', () => {
  it('enthält alle Kerndaten: Quote, Verbund-Größe, Firma, Vorhaben, Beantragungsweg', () => {
    const html = baueAntragZusammenfassungHtml(beispiel())
    expect(html).toContain('45') // Förderquote klein
    expect(html).toContain('ANG-2026-042')
    expect(html).toContain('40 Beschäftigten') // Verbund: 30 + 10 JAE
    expect(html).toContain('Industriestraße 12')
    expect(html).toContain('Mess- und Sensortechnik')
    expect(html).toContain('WissensReich Academy') // Concierge (nicht mehr Eskalator AG)
    expect(html).toContain('PDF-Anhang')
    expect(html).toContain('Geschäftsjahr 2025')
    expect(html).toContain('Zuschuss')
  })

  it('escaped HTML in Nutzereingaben (XSS-Schutz)', () => {
    const html = baueAntragZusammenfassungHtml(beispiel())
    expect(html).not.toContain('<Metallbau>')
    expect(html).toContain('&lt;Metallbau&gt;')
  })

  it('erklärt den Verbund nur, wenn Beteiligungen zugerechnet wurden', () => {
    const mit = baueAntragZusammenfassungHtml(beispiel())
    expect(mit).toContain('anteilig eingerechnet')
    const ohne = baueAntragZusammenfassungHtml(
      beispiel({
        kmu: evaluateKmu({ companyName: 'X', employees: 30, turnover: 4_000_000, balanceSheet: 2_500_000, holdings: [] }),
      }),
    )
    expect(ohne).toContain('allein Ihre eigenen Kennzahlen')
  })

  it('kennzeichnet Schätzungen nach Treu und Glauben', () => {
    const html = baueAntragZusammenfassungHtml(beispiel({ kmuSchaetzung: true }))
    expect(html).toContain('Schätzung nach Treu und Glauben')
  })

  it('lässt fehlende optionale Angaben sauber weg (keine „null“-Artefakte)', () => {
    const html = baueAntragZusammenfassungHtml(
      beispiel({ ustId: null, apRolle: null, investSumme: null, sensorenGesamt: null, projektende: null }),
    )
    expect(html).not.toContain('null')
    expect(html).not.toContain('undefined')
  })

  it('unterscheidet die Beantragungswege', () => {
    const selbst = baueAntragZusammenfassungHtml(beispiel({ beantragungsweg: 'selbst' }))
    expect(selbst).toContain('Durch Ihr Unternehmen selbst')
    expect(selbst).toContain('ELSTER')
  })
})
