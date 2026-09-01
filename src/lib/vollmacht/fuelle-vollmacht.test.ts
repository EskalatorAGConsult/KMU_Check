import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { fuelleVollmachtAus } from '@/lib/vollmacht/fuelle-vollmacht'

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
})
