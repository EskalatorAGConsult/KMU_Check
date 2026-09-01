import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { BEVOLLMAECHTIGTER } from '@/lib/vollmacht/bevollmaechtigter'

/**
 * Fuellt die offizielle BAFA-Vollmacht (Formular eew_vm_3, v1.0.0917,
 * © BAFA 2025) mit den Kundendaten aus. Die Vorlage liegt als AcroForm mit
 * 15 Textfeldern unter docs/vorlagen/ und wird nach dem Fuellen flachgerechnet
 * (nicht mehr editierbar, Archiv-Fassung).
 *
 * Feldbelegung (Position im Formular geprueft):
 * - Abschnitt 1 = Vollmachtgebende Person/Unternehmen (der Kunde)
 * - Abschnitt 2 = Bevollmaechtigte/r nach § 14 VwVfG (Eskalator AG)
 */

const VORLAGE = path.join(process.cwd(), 'docs', 'vorlagen', 'eew_formular_eew_vm_3.pdf')

export interface VollmachtgeberDaten {
  unternehmensname: string
  strasse: string
  plz: string
  ort: string
  vorgangsnummer: string
  /** Getippter vollstaendiger Name (einfache elektronische Signatur). */
  unterschriftName?: string | null
}

/**
 * Position der Zeile „Ort, Datum | Stempel und Unterschrift" auf Seite 2
 * (aus der Vorlage vermessen: Datum-Widget x 68–207, Unterschrifts-Label
 * ab x 210,3; Zeilengrundlinie ~y 437, PDF-Koordinaten von unten).
 */
const SIGNATUR = { seite: 1, x: 214, y: 437, maxBreite: 340 } as const

export async function fuelleVollmachtAus(geber: VollmachtgeberDaten): Promise<Uint8Array> {
  const vorlageBytes = await readFile(VORLAGE)
  const doc = await PDFDocument.load(vorlageBytes)
  const form = doc.getForm()

  const setze = (feldname: string, wert: string) => {
    if (!wert) return // leere Felder bleiben frei (nie „undefined" o. a. eintragen)
    form.getTextField(feldname).setText(wert)
  }

  // 1 · Vollmachtgebende/-s Person/Unternehmen (Kunde)
  setze('Name', geber.unternehmensname)
  setze('Vorgangsnummer', geber.vorgangsnummer)
  setze('Straße und Hausnummer', geber.strasse)
  setze('Postleitzahl', geber.plz)
  setze('Ort', geber.ort)

  // 2 · Bevollmaechtigte/-s nach § 14 VwVfG (Eskalator AG)
  setze('unternehmensname', BEVOLLMAECHTIGTER.name)
  setze('Anrede', BEVOLLMAECHTIGTER.anrede)
  setze('Vorname', BEVOLLMAECHTIGTER.vorname)
  setze('Nachname', BEVOLLMAECHTIGTER.nachname)
  setze('Telefon optional', BEVOLLMAECHTIGTER.telefon)
  setze('Beraternummer', BEVOLLMAECHTIGTER.beraternummer)
  setze('Straße und Hausnummer2', BEVOLLMAECHTIGTER.strasse)
  setze('Postleitzahl2', BEVOLLMAECHTIGTER.plz)
  setze('Ort2', BEVOLLMAECHTIGTER.ort)

  // 3 · Erklaerungszeile: „Ort, Datum" als kombiniertes Feld
  const datum = new Date().toLocaleDateString('de-DE')
  setze('Datum', geber.ort ? `${geber.ort}, ${datum}` : datum)

  // Erscheinungsbild mit eingebetteter Schrift neu rendern (Umlaute!), dann flachrechnen
  const schrift = await doc.embedFont(StandardFonts.Helvetica)
  form.updateFieldAppearances(schrift)
  form.flatten()

  // 4 · Online-Unterschrift auf die Signaturzeile zeichnen (nach dem Flatten,
  // damit sie Teil des Archiv-Inhalts wird). Kursiv + Dunkelblau als
  // visueller Hinweis auf die elektronische Signatur.
  const name = geber.unterschriftName?.trim()
  if (name) {
    const kursiv = await doc.embedFont(StandardFonts.HelveticaOblique)
    let groesse = 14
    while (groesse > 8 && kursiv.widthOfTextAtSize(name, groesse) > SIGNATUR.maxBreite) groesse -= 1
    doc.getPage(SIGNATUR.seite).drawText(name, {
      x: SIGNATUR.x,
      y: SIGNATUR.y,
      size: groesse,
      font: kursiv,
      color: rgb(0.08, 0.15, 0.4),
    })
  }

  doc.setTitle(`Vollmacht ${geber.vorgangsnummer}`)
  doc.setAuthor('MABE Förderportal / BAFA-Formular eew_vm_3')
  doc.setProducer('MABE Förderportal')
  doc.setCreationDate(new Date())

  return doc.save()
}
