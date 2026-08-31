import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import type { DossierDaten } from '@/lib/dossier/generate'
import { generiereDossier } from '@/lib/dossier/generate'
import { generiereSystemkonzept } from '@/lib/systemkonzept/generate'

/**
 * PDF-Generatoren: pruefen, dass valide PDFs entstehen (pdf-lib kann sie
 * wieder laden) und die fachlichen Varianten (mit/ohne Steuerungstechnik)
 * funktionieren.
 */

const angebot = {
  angebot_nr: 'ANG-2026-042',
  angebot_datum: '2026-08-15',
  technologien: ['software', 'messtechnik', 'steuerung'] as ('software' | 'messtechnik' | 'steuerung')[],
  invest_software: 12500,
  invest_messtechnik: 24800,
  invest_steuerung: 9700,
  sensoren_gesamt: 24,
  sensoren_prozessbezug: 11,
  projektende: '2027-03-31',
}

const stammdaten = {
  unternehmensname: 'Müller & Söhne Metallbau GmbH',
  strasse: 'Industriestraße 12',
  plz: '08060',
  ort: 'Zwickau',
  land: 'Deutschland',
  wz_code: '25.11',
  ap_rolle: 'Geschäftsführung',
  ap_vorname: 'Jürgen',
  ap_nachname: 'Müller',
  standort_strasse: 'Werkstraße 3',
  standort_plz: '08058',
  standort_ort: 'Zwickau',
}

describe('generiereSystemkonzept', () => {
  it('erzeugt ein valides PDF mit Steuerungs-Kapitel', async () => {
    const bytes = await generiereSystemkonzept(angebot, stammdaten, { kategorie: 'klein', foerderquotePct: 45 })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
    expect(doc.getTitle()).toContain('ANG-2026-042')
  })

  it('Variante ohne Steuerungstechnik (Kapitelnummerierung rutscht)', async () => {
    const bytes = await generiereSystemkonzept(
      { ...angebot, technologien: ['software', 'messtechnik'], invest_steuerung: null },
      stammdaten,
      { kategorie: 'kleinst', foerderquotePct: 45 },
    )
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('vertraegt fehlende optionale Werte (null)', async () => {
    const bytes = await generiereSystemkonzept(
      { ...angebot, sensoren_gesamt: null, sensoren_prozessbezug: null, projektende: null },
      { ...stammdaten, standort_strasse: null, standort_plz: null, standort_ort: null },
      { kategorie: 'mittel', foerderquotePct: 35 },
    )
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })
})

describe('generiereDossier', () => {
  it('erzeugt ein valides Dossier-PDF aus allen Vorgangsdaten', async () => {
    const daten: DossierDaten = {
      angebot: {
        ...angebot,
        id: 'a1',
        angelegt_von: 'u1',
        status: 'eingereicht',
        kunde_firma: 'Müller & Söhne Metallbau GmbH',
        kunde_ansprechpartner: null,
        kunde_email: 'info@example.de',
        software_variante: 'mabe_cloud',
        notiz: null,
        angebot_pdf_path: null,
        extraktion: null,
        extrahiert_am: null,
        extraktion_bestaetigt: false,
        created_at: '2026-08-15T00:00:00Z',
        updated_at: '2026-08-15T00:00:00Z',
      },
      stammdaten: {
        ...stammdaten,
        email: 'info@example.de',
        unternehmensart: 'eigenstaendig',
        vorsteuerabzug: true,
        personenart: 'juristisch',
        steuernummer: '123/456/78901',
        gruppenzugehoerigkeit: 'privat',
        wirtschaftlich_taetig: true,
        ap_anrede: 'Herr',
        ap_email: 'jm@example.de',
        kontoinhaber: 'Müller & Söhne Metallbau GmbH',
        iban: 'DE02120300000000202051',
      },
      beteiligungen: [
        { name: 'Müller Holding AG', richtung: 'aufwaerts', anteil_pct: 60, jae: 10, umsatz: 2_000_000, bilanzsumme: 1_000_000 },
      ],
      kmu: { kategorie: 'klein', foerderquote_pct: 45, geschaeftsjahr: 2025, jae: 25, umsatz: 3_000_000, bilanzsumme: 2_000_000 },
      deminimis: { fusion_3j: false, uebernahme_3j: false, aufspaltung_3j: false, summe_eur: 150_000, bestaetigt_at: '2026-08-20T10:00:00Z' },
      beihilfen: [
        { beihilfegeber: 'Land Sachsen', aktenzeichen: 'AZ-123', bewilligt_am: '2024-05-01', betrag: 150_000, form: 'zuschuss', status: 'gewaehrt' },
      ],
      vollmacht: { beantragungsweg: 'eskalator', unterzeichnet_von: 'Jürgen Müller', unterzeichnet_at: '2026-08-20T10:05:00Z' },
    }
    const bytes = await generiereDossier(daten)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
    expect(doc.getTitle()).toContain('ANG-2026-042')
  })
})
