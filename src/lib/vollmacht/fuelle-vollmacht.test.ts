import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { BEVOLLMAECHTIGTER } from '@/lib/vollmacht/bevollmaechtigter'
import { fuelleVollmachtAus, formatiereUnterschriftsdatum } from '@/lib/vollmacht/fuelle-vollmacht'

describe('BEVOLLMAECHTIGTER (Vollmachtnehmer, Abschnitt 2 des Formulars)', () => {
  it('ist vollstaendig gepflegt: WissensReich Academy UG, Köln, Antonja Brücker', () => {
    expect(BEVOLLMAECHTIGTER.name).toBe('WissensReich Academy UG (haftungsbeschränkt)')
    expect(BEVOLLMAECHTIGTER.anrede).toBe('Frau')
    expect(BEVOLLMAECHTIGTER.vorname).toBe('Antonja')
    expect(BEVOLLMAECHTIGTER.nachname).toBe('Brücker')
    expect(BEVOLLMAECHTIGTER.strasse).toBe('Weinsbergstraße 190')
    expect(BEVOLLMAECHTIGTER.plz).toBe('50825')
    expect(BEVOLLMAECHTIGTER.ort).toBe('Köln')
  })
})

describe('formatiereUnterschriftsdatum', () => {
  it('formatiert TT.MM.JJJJ mit fuehrenden Nullen (BAFA-Formular)', () => {
    expect(formatiereUnterschriftsdatum(new Date(2026, 8, 1))).toBe('01.09.2026')
    expect(formatiereUnterschriftsdatum(new Date(2026, 11, 25))).toBe('25.12.2026')
  })
})

/**
 * BAFA-Vollmacht (eew_vm_3): prueft, dass das offizielle Formular gefuellt,
 * flachgerechnet, mit Online-Signatur versehen und als valides PDF
 * gespeichert wird. (Sichtbarer Text wird zusaetzlich per pypdf in der
 * Shell verifiziert – pdf-lib kann keinen Text extrahieren.)
 */
describe('fuelleVollmachtAus', () => {
  it('fuellt das BAFA-Formular und rechnet es flach', async () => {
    const bytes = await fuelleVollmachtAus({
      unternehmensname: 'Müller & Söhne Metallbau GmbH',
      strasse: 'Industriestraße 12',
      plz: '08060',
      ort: 'Zwickau',
      vorgangsnummer: 'ANG-2026-042',
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2) // BAFA-Vorlage hat genau 2 Seiten
    expect(doc.getTitle()).toContain('ANG-2026-042')
    // Nach dem Flatten existieren keine Formularfelder mehr (Archiv-Fassung)
    expect(doc.getForm().getFields().length).toBe(0)
  })

  it('zeichnet die Online-Signatur auf Seite 2 und bleibt valide', async () => {
    const bytes = await fuelleVollmachtAus({
      unternehmensname: 'Müller & Söhne Metallbau GmbH',
      strasse: 'Industriestraße 12',
      plz: '08060',
      ort: 'Zwickau',
      vorgangsnummer: 'ANG-2026-043',
      unterschriftName: 'Maximilian Mustermann-Schmidt mit sehr langem Namen',
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getForm().getFields().length).toBe(0)
  })

  it('vertraegt leere optionale Angaben', async () => {
    const bytes = await fuelleVollmachtAus({
      unternehmensname: 'Einzelunternehmen Test',
      strasse: '',
      plz: '08060',
      ort: '',
      vorgangsnummer: 'X-1',
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
  })

  it('bettet eine gezeichnete Signatur (PNG) ein und bleibt valide', async () => {
    // Kleines valides PNG (2x2 px, dunkelblau, transparent) als Platzhalter-Signatur
    const png = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQI12NkYGD4zwAEjAwM/0kTAAAu4wMBlRlHmwAAAABJRU5ErkJggg==',
        'base64',
      ),
    )
    const bytes = await fuelleVollmachtAus({
      unternehmensname: 'Müller & Söhne Metallbau GmbH',
      strasse: 'Industriestraße 12',
      plz: '08060',
      ort: 'Zwickau',
      vorgangsnummer: 'ANG-2026-044',
      unterschriftName: 'Max Mustermann',
      signaturPng: png,
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getForm().getFields().length).toBe(0)
    // Das eingebettete Bild muss als XObject im PDF landen
    expect(Buffer.from(bytes).includes('XObject')).toBe(true)
  })

  it('faellt bei defektem PNG auf die Namenssignatur zurueck', async () => {
    const bytes = await fuelleVollmachtAus({
      unternehmensname: 'Test GmbH',
      strasse: 'Weg 1',
      plz: '12345',
      ort: 'Berlin',
      vorgangsnummer: 'ANG-2026-045',
      unterschriftName: 'Erika Muster',
      signaturPng: Uint8Array.from([1, 2, 3, 4]), // kein PNG
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
  })
})
