import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'

/**
 * Gemeinsame PDF-Bausteine (MABE-CI) fuer alle generierten Dokumente
 * (Systemkonzept, Kunden-Dossier). A4-Layout mit Kopfbereich, Abschnitten,
 * Label/Wert-Zeilen und Fusszeile. pdf-lib WinAnsi: Umlaute ok, aber kein
 * Euro-Zeichen – Betraege daher mit eur() formatieren.
 */

export const NAVY = rgb(0.082, 0.153, 0.247) // mabe-900
export const TEAL = rgb(0.169, 0.608, 0.702) // teal-600
export const GRAU = rgb(0.333, 0.376, 0.451) // olive-600
export const HELL = rgb(0.925, 0.929, 0.945) // olive-200

export const SEITE = { breite: 595.28, hoehe: 841.89, rand: 56 } // A4

/** Betrag deutsch formatiert ohne Euro-Zeichen (WinAnsi-kompatibel). */
export function eur(betrag: number | null | undefined): string {
  if (betrag == null) return '–'
  return `${betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`
}

export function datumDE(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('de-DE')
}

export async function neuesPdfDokument(titel: string, betreff: string) {
  const doc = await PDFDocument.create()
  doc.setTitle(titel)
  doc.setAuthor('MABE Maschinen- und Behälterbau GmbH')
  doc.setSubject(betreff)
  doc.setProducer('MABE Förderportal')
  doc.setCreationDate(new Date())
  const fett = await doc.embedFont(StandardFonts.HelveticaBold)
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  return { doc, fett, normal }
}

/** Einfacher Layout-Writer mit Seitenumbruch und Zeilenumbruch. */
export class Writer {
  private seite: PDFPage
  private y: number
  constructor(
    private doc: PDFDocument,
    private fett: PDFFont,
    private normal: PDFFont,
  ) {
    this.seite = doc.addPage([SEITE.breite, SEITE.hoehe])
    this.y = SEITE.hoehe - SEITE.rand
  }

  private breiteVon(text: string, size: number, font: PDFFont): number {
    return font.widthOfTextAtSize(text, size)
  }

  private neueSeiteWennNoetig(bedarf: number) {
    if (this.y - bedarf < SEITE.rand) {
      this.seite = this.doc.addPage([SEITE.breite, SEITE.hoehe])
      this.y = SEITE.hoehe - SEITE.rand
    }
  }

  abstand(h: number) {
    this.y -= h
  }

  ueberschrift(text: string) {
    // 56pt Bedarf, damit eine Ueberschrift nie verwaist am Seitenende steht
    this.neueSeiteWennNoetig(56)
    this.y -= 6
    this.seite.drawText(text, { x: SEITE.rand, y: this.y, size: 12, font: this.fett, color: NAVY })
    this.y -= 8
    this.seite.drawLine({
      start: { x: SEITE.rand, y: this.y },
      end: { x: SEITE.breite - SEITE.rand, y: this.y },
      thickness: 0.8,
      color: TEAL,
    })
    this.y -= 14
  }

  absatz(text: string, size = 10) {
    const maxBreite = SEITE.breite - 2 * SEITE.rand
    const zeilen: string[] = []
    let rest = text
    while (rest.length > 0) {
      if (this.breiteVon(rest, size, this.normal) <= maxBreite) {
        zeilen.push(rest)
        break
      }
      let i = rest.length
      while (i > 0 && this.breiteVon(rest.slice(0, i), size, this.normal) > maxBreite) i--
      let schnitt = rest.lastIndexOf(' ', i)
      if (schnitt <= 0) schnitt = i
      zeilen.push(rest.slice(0, schnitt))
      rest = rest.slice(schnitt).trimStart()
    }
    this.neueSeiteWennNoetig(zeilen.length * (size + 3))
    for (const zeile of zeilen) {
      this.seite.drawText(zeile, { x: SEITE.rand, y: this.y, size, font: this.normal, color: NAVY })
      this.y -= size + 3.5
    }
    this.y -= 5
  }

  zeile(label: string, wert: string) {
    this.neueSeiteWennNoetig(16)
    this.seite.drawText(label, { x: SEITE.rand, y: this.y, size: 9.5, font: this.normal, color: GRAU })
    this.seite.drawText(wert, {
      x: SEITE.rand + 200,
      y: this.y,
      size: 9.5,
      font: this.fett,
      color: NAVY,
    })
    this.y -= 16
  }

  fusszeile(text: string) {
    const seiten = this.doc.getPages()
    seiten.forEach((s, i) => {
      s.drawRectangle({ x: 0, y: 0, width: SEITE.breite, height: 34, color: HELL })
      s.drawText(`${text} · Seite ${i + 1} von ${seiten.length}`, {
        x: SEITE.rand,
        y: 13,
        size: 8,
        font: this.normal,
        color: GRAU,
      })
    })
  }

  kopf(titel: string, untertitel: string, metaZeilen: [string, string]) {
    this.seite.drawRectangle({ x: 0, y: SEITE.hoehe - 124, width: SEITE.breite, height: 124, color: NAVY })
    this.seite.drawText(titel, { x: SEITE.rand, y: SEITE.hoehe - 52, size: 22, font: this.fett, color: rgb(1, 1, 1) })
    this.seite.drawText(untertitel, {
      x: SEITE.rand,
      y: SEITE.hoehe - 74,
      size: 10.5,
      font: this.normal,
      color: rgb(0.75, 0.85, 0.9),
    })
    this.seite.drawText(metaZeilen[0], {
      x: SEITE.rand,
      y: SEITE.hoehe - 94,
      size: 9,
      font: this.normal,
      color: rgb(0.6, 0.72, 0.8),
    })
    this.seite.drawText(metaZeilen[1], {
      x: SEITE.rand,
      y: SEITE.hoehe - 108,
      size: 9,
      font: this.normal,
      color: rgb(0.6, 0.72, 0.8),
    })
    this.y = SEITE.hoehe - 152
  }
}
