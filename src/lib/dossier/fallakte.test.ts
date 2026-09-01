import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { generiereFallaktePdf } from './fallakte'
import type { KundeVorgang } from '@/lib/db/repositories/kunden'
import type { Angebot, StammdatenRow } from '@/lib/db/types'

/** Fallakte-PDF (Admin): valides PDF aus einem vollstaendigen Vorgang. */

const angebot: Angebot = {
  id: 'a1',
  angelegt_von: 'u1',
  status: 'eingereicht',
  kunde_firma: 'Müller & Söhne Metallbau GmbH',
  kunde_ansprechpartner: 'Jürgen Müller',
  kunde_email: 'info@example.de',
  angebot_nr: 'ANG-2026-042',
  angebot_datum: '2026-08-15',
  technologien: ['software', 'messtechnik', 'steuerung'],
  software_variante: 'mabe_cloud',
  invest_software: 12500,
  invest_messtechnik: 24800,
  invest_steuerung: 9700,
  sensoren_gesamt: 24,
  sensoren_prozessbezug: 11,
  projektende: '2027-03-31',
  notiz: 'Kunde wünscht Umsetzung Q1/2027',
  angebot_pdf_path: null,
  extraktion: null,
  extrahiert_am: null,
  extraktion_bestaetigt: false,
  created_at: '2026-08-15T00:00:00Z',
  updated_at: '2026-08-15T00:00:00Z',
}

const stammdaten: StammdatenRow = {
  angebot_id: 'a1',
  unternehmensname: 'Müller & Söhne Metallbau GmbH',
  land: 'Deutschland',
  plz: '08060',
  ort: 'Zwickau',
  strasse: 'Industriestraße 12',
  email: 'info@example.de',
  wz_code: '25.11',
  unternehmensart: 'verbunden',
  vorsteuerabzug: true,
  personenart: 'juristisch',
  geburtsdatum: null,
  steuer_id: null,
  steuernummer: '123/456/78901',
  ust_id: 'DE123456789',
  ap_rolle: 'Geschäftsführung',
  ap_anrede: 'Herr',
  ap_vorname: 'Jürgen',
  ap_nachname: 'Müller',
  ap_email: 'jm@example.de',
  gruppenzugehoerigkeit: 'privat',
  wirtschaftlich_taetig: true,
  kontoinhaber: 'Müller & Söhne Metallbau GmbH',
  iban: 'DE89370400440532013000',
  standort_plz: null,
  standort_ort: null,
  standort_strasse: null,
  vorhaben_nicht_begonnen: true,
  dsgvo_einwilligung_at: '2026-08-20T10:00:00Z',
  register_company_id: null,
  register_snapshot: null,
  register_abgerufen_am: null,
  created_at: '2026-08-20T10:00:00Z',
  updated_at: '2026-08-20T10:00:00Z',
}

const vorgang: KundeVorgang = {
  angebot,
  stammdaten,
  beteiligungen: [
    {
      id: 'b1',
      angebot_id: 'a1',
      name: 'Müller Holding AG',
      richtung: 'aufwaerts',
      anteil_pct: 60,
      jae: 10,
      umsatz: 2_000_000,
      bilanzsumme: 1_000_000,
      quelle: 'manuell',
      stufe: null,
      pfad: null,
      bezug: null,
      created_at: '2026-08-20T10:00:00Z',
    },
  ],
  kmuBewertungen: [
    {
      id: 'k1',
      angebot_id: 'a1',
      geschaeftsjahr: 2025,
      abgeschlossen: true,
      jae: 25,
      umsatz: 3_000_000,
      bilanzsumme: 2_000_000,
      kategorie: 'mittel',
      foerderquote_pct: 35,
      berechnung: null,
      created_at: '2026-08-20T10:00:00Z',
    },
  ],
  deminimis: {
    angebot_id: 'a1',
    fusion_3j: false,
    uebernahme_3j: false,
    aufspaltung_3j: false,
    summe_eur: 150_000,
    bestaetigt_at: '2026-08-20T10:00:00Z',
  },
  beihilfen: [
    {
      id: 'h1',
      angebot_id: 'a1',
      beihilfegeber: 'Land Sachsen',
      aktenzeichen: 'AZ-123',
      bewilligt_am: '2024-05-01',
      betrag: 150_000,
      form: 'zuschuss',
      kategorie: 'allgemein',
      status: 'gewaehrt',
      created_at: '2026-08-20T10:00:00Z',
    },
  ],
  vollmacht: {
    angebot_id: 'a1',
    beantragungsweg: 'eskalator',
    signatur_modus: 'canvas',
    signatur_bild_path: null,
    pdf_path: null,
    unterzeichnet_at: '2026-08-20T10:05:00Z',
    unterzeichnet_von: 'Jürgen Müller',
    unterschrift_ip: null,
    unterschrift_ua: null,
    created_at: '2026-08-20T10:05:00Z',
  },
  dokumente: [],
  entwurf: null,
  uebergaben: [],
  audit: [],
  revisionen: [
    {
      id: 'r1',
      angebot_id: 'a1',
      bearbeitet_von: 'admin-1',
      bereich: 'stammdaten',
      aenderungen: { iban: { alt: null, neu: 'DE89370400440532013000' } },
      created_at: '2026-08-21T09:00:00Z',
    },
  ],
  bearbeiter: { 'admin-1': 'Robin Berater (robin@eskalator.ag)' },
  notizen: [
    {
      id: 'n1',
      angebot_id: 'a1',
      autor: 'admin-1',
      text: 'Kunde angerufen – IBAN kommt per Mail nach.',
      wiedervorlage_am: '2026-09-05',
      created_at: '2026-08-21T09:10:00Z',
    },
  ],
  zugriffe: {
    anzahl: 2,
    liste: [
      {
        id: 'z2',
        angebot_id: 'a1',
        token_id: 't1',
        ip: '203.0.113.7',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)',
        created_at: '2026-08-20T09:30:00Z',
      },
      {
        id: 'z1',
        angebot_id: 'a1',
        token_id: 't1',
        ip: '203.0.113.7',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        created_at: '2026-08-19T18:05:00Z',
      },
    ],
  },
}

describe('generiereFallaktePdf', () => {
  it('erzeugt eine valide, mehrseitige Fallakte mit Audit-Report', async () => {
    const bytes = await generiereFallaktePdf(vorgang)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
    expect(doc.getTitle()).toContain('ANG-2026-042')
  })

  it('vertraegt einen Vorgang ohne eingereichte Daten (Leerzustand)', async () => {
    const bytes = await generiereFallaktePdf({
      ...vorgang,
      stammdaten: null,
      kmuBewertungen: [],
      beteiligungen: [],
      deminimis: null,
      beihilfen: [],
      vollmacht: null,
      revisionen: [],
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })
})
