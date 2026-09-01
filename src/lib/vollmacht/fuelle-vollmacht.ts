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
  /** Getippter vollstaendiger Name (Nachweis des Unterzeichners). */
  unterschriftName?: string | null
  /** Gezeichnete Unterschrift als PNG (transparent) – wird an der Signaturzeile eingezeichnet. */
  signaturPng?: Uint8Array | null
}

/**
 * Position der Zeile „Ort, Datum | Stempel und Unterschrift" auf Seite 2
 * (aus der Vorlage vermessen: Datum-Widget x 68–207, Unterschrifts-Label
 * ab x 210,3; Zeilengrundlinie ~y 437, PDF-Koordinaten von unten).
 */
const SIGNATUR = { seite: 1, x: 214, y: 437, maxBreite: 340, maxHoehe: 52 } as const

/** Fallback: getippter Name in Kursiv/Dunkelblau als einfache elektronische Signatur. */
async function zeichneNamenssignatur(doc: PDFDocument, name: string | undefined) {
  if (!name) return
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
  // damit sie Teil des Archiv-Inhalts wird). Bevorzugt die GEZEICHNETE
  // Signatur (PNG, aspect-fit in die Signaturzeile); der getippte Name dient
  // als Fallback und zusaetzlich als kleine Bildunterschrift.
  const name = geber.unterschriftName?.trim()
  const seite = doc.getPage(SIGNATUR.seite)
  if (geber.signaturPng && geber.signaturPng.length > 0) {
    try {
      const bild = await doc.embedPng(geber.signaturPng)
      const skalierung = Math.min(SIGNATUR.maxBreite / bild.width, SIGNATUR.maxHoehe / bild.height)
      seite.drawImage(bild, {
        x: SIGNATUR.x,
        y: SIGNATUR.y + 2, // Unterkante knapp auf der Grundlinie
        width: bild.width * skalierung,
        height: bild.height * skalierung,
      })
      if (name) {
        const schriftKlein = await doc.embedFont(StandardFonts.Helvetica)
        seite.drawText(name, {
          x: SIGNATUR.x,
          y: SIGNATUR.y - 11,
          size: 7.5,
          font: schriftKlein,
          color: rgb(0.35, 0.4, 0.45),
        })
      }
    } catch (e) {
      // Bild defekt -> auf getippten Namen zurueckfallen (Signatur nicht verlieren)
      console.error('[vollmacht] Signaturbild konnte nicht eingebettet werden:', e)
      await zeichneNamenssignatur(doc, name)
    }
  } else {
    await zeichneNamenssignatur(doc, name)
  }

  doc.setTitle(`Vollmacht ${geber.vorgangsnummer}`)
  doc.setAuthor('MABE Förderportal / BAFA-Formular eew_vm_3')
  doc.setProducer('MABE Förderportal')
  doc.setCreationDate(new Date())

  return doc.save()
}
