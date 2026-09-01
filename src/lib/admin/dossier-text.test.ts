import { describe, expect, it } from 'vitest'

import { baueDossierText, type DossierTextEingabe } from '@/lib/admin/dossier-text'
import type { Angebot } from '@/lib/db/types'

const angebot: Angebot = {
  id: 'a1',
  angelegt_von: 'u1',
  status: 'eingereicht',
  kunde_firma: 'Muster GmbH',
  kunde_ansprechpartner: 'Max Muster',
  kunde_email: 'max@muster.de',
  angebot_nr: 'AN-2026-001',
  angebot_datum: '2026-01-15',
  technologien: ['software', 'messtechnik'],
  software_variante: 'mabe_cloud',
  invest_software: 20000,
  invest_messtechnik: 30000,
  invest_steuerung: null,
  sensoren_gesamt: 12,
  sensoren_prozessbezug: 5,
  projektende: '2026-12-31',
  notiz: null,
  angebot_pdf_path: null,
  extraktion: null,
  extrahiert_am: null,
  extraktion_bestaetigt: false,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
}

const vollstaendig: DossierTextEingabe = {
  angebot,
  stammdaten: {
    angebot_id: 'a1',
    unternehmensname: 'Muster GmbH',
    land: 'Deutschland',
    plz: '45468',
    ort: 'Mülheim an der Ruhr',
    strasse: 'Musterstraße 1',
    email: 'info@muster.de',
    wz_code: '28.29',
    unternehmensart: 'partner',
    vorsteuerabzug: true,
    personenart: 'juristisch',
    geburtsdatum: null,
    steuer_id: null,
    steuernummer: '123/456/78901',
    ust_id: 'DE123456789',
    ap_rolle: 'Geschäftsführung',
    ap_anrede: 'Herr',
    ap_vorname: 'Max',
    ap_nachname: 'Muster',
    ap_email: 'max@muster.de',
    gruppenzugehoerigkeit: 'privat',
    wirtschaftlich_taetig: true,
    kontoinhaber: 'Muster GmbH',
    iban: 'DE02120300000000202051',
    standort_plz: null,
    standort_ort: null,
    standort_strasse: null,
    vorhaben_nicht_begonnen: true,
    dsgvo_einwilligung_at: '2026-02-01T09:00:00Z',
    register_company_id: null,
    register_snapshot: null,
    register_abgerufen_am: null,
    created_at: '2026-02-01T09:00:00Z',
    updated_at: '2026-02-01T09:00:00Z',
  },
  beteiligungen: [
    {
      id: 'b1',
      angebot_id: 'a1',
      name: 'Holding AG',
      richtung: 'aufwaerts',
      anteil_pct: 60,
      jae: 300,
      umsatz: 80_000_000,
      bilanzsumme: 60_000_000,
      quelle: 'openregister',
      stufe: 2,
      pfad: 'Top Holding SE hält 100 % an Holding AG',
      bezug: null,
      created_at: '2026-02-01T09:00:00Z',
    },
  ],
  kmuBewertungen: [
    {
      id: 'k1',
      angebot_id: 'a1',
      geschaeftsjahr: 2025,
      abgeschlossen: true,
      jae: 20,
      umsatz: 5_000_000,
      bilanzsumme: 3_000_000,
      kategorie: 'gross',
      foerderquote_pct: 25,
      berechnung: {
        own: { employees: 20, turnover: 5_000_000, balanceSheet: 3_000_000 },
        partnerContribution: { employees: 0, turnover: 0, balanceSheet: 0 },
        linkedContribution: { employees: 300, turnover: 80_000_000, balanceSheet: 60_000_000 },
        consolidated: { employees: 320, turnover: 85_000_000, balanceSheet: 63_000_000 },
        category: 'gross',
        categoryLabel: 'Großunternehmen (kein KMU)',
        isKmu: false,
        fundingRatePct: 25,
        reasons: ['Mit 320 Jahresarbeitseinheiten wird die Grenze von 250 erreicht oder überschritten.'],
        nearThreshold: false,
      },
      created_at: '2026-02-01T09:00:00Z',
    },
  ],
  deminimis: {
    angebot_id: 'a1',
    fusion_3j: false,
    uebernahme_3j: true,
    aufspaltung_3j: false,
    summe_eur: 50000,
    bestaetigt_at: '2026-02-01T09:00:00Z',
  },
  beihilfen: [
    {
      id: 'd1',
      angebot_id: 'a1',
      beihilfegeber: 'Land NRW',
      aktenzeichen: 'AZ-123',
      bewilligt_am: '2024-05-01',
      betrag: 50000,
      form: 'zuschuss',
      kategorie: 'allgemein',
      status: 'gewaehrt',
      created_at: '2026-02-01T09:00:00Z',
    },
  ],
  vollmacht: {
    angebot_id: 'a1',
    beantragungsweg: 'eskalator',
    signatur_modus: 'canvas',
    signatur_bild_path: null,
    pdf_path: null,
    unterzeichnet_at: '2026-02-01T09:05:00Z',
    unterzeichnet_von: 'Max Muster',
    unterschrift_ip: null,
    unterschrift_ua: null,
    created_at: '2026-02-01T09:05:00Z',
  },
}

describe('baueDossierText', () => {
  const text = baueDossierText(vollstaendig)

  it('folgt der Reihenfolge des BAFA-Formulars', () => {
    const reihenfolge = [
      '1 · UNTERNEHMEN',
      '2 · ANSPRECHPARTNER',
      '3 · ANGABEN ZUM ANTRAG',
      '4 · BANKVERBINDUNG',
      '5 · KMU-EINSTUFUNG',
      '6 · STANDORT DER MASSNAHME',
      '7 · TECHNISCHE MASSNAHME',
      '8 · DE-MINIMIS-ERKLÄRUNG',
      '9 · VOLLMACHT & BEANTRAGUNGSWEG',
    ]
    let position = -1
    for (const abschnitt of reihenfolge) {
      const naechste = text.indexOf(abschnitt)
      expect(naechste, `Abschnitt fehlt: ${abschnitt}`).toBeGreaterThan(position)
      position = naechste
    }
  })

  it('enthält alle BAFA-Pflichtfelder kopierfähig', () => {
    expect(text).toContain('Unternehmensname: Muster GmbH')
    expect(text).toContain('WZ-Code (2008): 28.29')
    expect(text).toContain('USt-IdNr.: DE123456789')
    expect(text).toContain('Steuernummer: 123/456/78901')
    expect(text).toContain('IBAN: DE02120300000000202051')
    expect(text).toContain('Vorsteuerabzugsberechtigt: ja')
    expect(text).toContain('Gruppenzugehörigkeit: Privates Unternehmen')
  })

  it('weist KMU-Ergebnis, Verbundkette und Zuschuss aus', () => {
    expect(text).toContain('Großunternehmen (kein KMU) · Förderquote 25 %')
    expect(text).toContain('Holding AG')
    expect(text).toContain('Kette Stufe 2 (Top Holding SE hält 100 % an Holding AG)')
    expect(text).toContain('Voraussichtlicher Zuschuss: 12.500')
  })

  it('weist De-minimis und Vollmacht aus', () => {
    expect(text).toContain('De-minimis-Beihilfen gesamt (3 Jahre): 50.000')
    expect(text).toContain('Land NRW (AZ-123)')
    expect(text).toContain('Beantragung durch den Fördermittel-Concierge der Eskalator AG')
    expect(text).toContain('Vollmacht unterzeichnet von: Max Muster')
  })

  it('kennzeichnet fehlende Einreichung explizit', () => {
    const leer = baueDossierText({
      angebot,
      stammdaten: null,
      beteiligungen: [],
      kmuBewertungen: [],
      deminimis: null,
      beihilfen: [],
      vollmacht: null,
    })
    expect(leer).toContain('noch nicht eingereicht')
    expect(leer).toContain('Wie Firmenanschrift')
  })
})
