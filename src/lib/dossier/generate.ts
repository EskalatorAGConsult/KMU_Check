import 'server-only'

import type { Angebot, Technologie } from '@/lib/db/types'
import { CATEGORY_LABELS, type Category } from '@/lib/kmu'
import { Writer, datumDE, eur, neuesPdfDokument } from '@/lib/pdf/writer'

/**
 * Kunden-Dossier: vollstaendige Datenzusammenstellung eines Vorgangs als PDF
 * (Selbstauskunft des Kunden / interne Ablage). Enthaelt alle eingereichten
 * Angaben – der Kunde kann damit jederzeit einsehen, welche Daten gespeichert
 * und fuer die Antragstellung verwendet werden.
 */

const TECHNOLOGIE_LABELS: Record<Technologie, string> = {
  software: 'Energiemanagement-Software',
  messtechnik: 'Mess- und Sensorik',
  steuerung: 'Steuerungstechnik (MSR)',
}

export interface DossierDaten {
  angebot: Angebot
  stammdaten: Record<string, unknown>
  beteiligungen: {
    name: string
    richtung: string
    anteil_pct: number
    jae: number | null
    umsatz: number | null
    bilanzsumme: number | null
  }[]
  kmu: { kategorie: string; foerderquote_pct: number; geschaeftsjahr: number; jae: number; umsatz: number; bilanzsumme: number } | null
  deminimis: {
    fusion_3j: boolean
    uebernahme_3j: boolean
    aufspaltung_3j: boolean
    summe_eur: number
    bestaetigt_at: string
  } | null
  beihilfen: {
    beihilfegeber: string
    aktenzeichen: string | null
    bewilligt_am: string
    betrag: number
    form: string
    status: string
  }[]
  vollmacht: {
    beantragungsweg: string
    unterzeichnet_von: string | null
    unterzeichnet_at: string | null
  } | null
}

function s(v: unknown): string {
  return v == null || v === '' ? '–' : String(v)
}

function jaNein(v: unknown): string {
  return v ? 'ja' : 'nein'
}

export async function generiereDossier(d: DossierDaten): Promise<Uint8Array> {
  const { doc, fett, normal } = await neuesPdfDokument(
    `Datenübersicht ${d.angebot.angebot_nr}`,
    'Kunden-Dossier – MABE Förderportal (BAFA EEW Modul 3)',
  )
  const w = new Writer(doc, fett, normal)
  const sd = d.stammdaten

  w.kopf('Datenübersicht', 'Ihre eingereichten Angaben für das Förderverfahren', [
    `Vorgang ${d.angebot.angebot_nr} · BAFA EEW Modul 3 (Energiemanagementsysteme)`,
    `Erstellt am ${datumDE(new Date().toISOString())} · MABE Förderportal`,
  ])

  w.ueberschrift('1 · Angebot und Vorhaben')
  w.zeile('Angebot', `${d.angebot.angebot_nr} vom ${datumDE(d.angebot.angebot_datum)}`)
  w.zeile('Technologien', d.angebot.technologien.map((t) => TECHNOLOGIE_LABELS[t]).join(', '))
  w.zeile('Geplantes Projektende', datumDE(d.angebot.projektende))
  w.abstand(6)

  w.ueberschrift('2 · Unternehmensdaten')
  w.zeile('Unternehmen', s(sd.unternehmensname))
  w.zeile('Anschrift', `${s(sd.strasse)}, ${s(sd.plz)} ${s(sd.ort)}, ${s(sd.land)}`)
  w.zeile('E-Mail', s(sd.email))
  w.zeile('WZ-Code', s(sd.wz_code))
  w.zeile('Unternehmensart (EU)', s(sd.unternehmensart))
  w.zeile('Vorsteuerabzugsberechtigt', jaNein(sd.vorsteuerabzug))
  w.zeile('Personenart', s(sd.personenart))
  if (sd.personenart === 'juristisch') {
    w.zeile('Steuernummer', s(sd.steuernummer))
    w.zeile('USt-IdNr.', s(sd.ust_id))
  } else {
    w.zeile('Steuer-ID', s(sd.steuer_id))
    w.zeile('Geburtsdatum', s(sd.geburtsdatum))
  }
  w.zeile('Gruppenzugehörigkeit', s(sd.gruppenzugehoerigkeit))
  w.zeile('Wirtschaftlich tätig', jaNein(sd.wirtschaftlich_taetig))
  w.abstand(6)

  w.ueberschrift('3 · Ansprechpartner und Auszahlung')
  w.zeile('Ansprechpartner', `${s(sd.ap_anrede)} ${s(sd.ap_vorname)} ${s(sd.ap_nachname)} (${s(sd.ap_rolle)})`)
  w.zeile('E-Mail (Ansprechpartner)', s(sd.ap_email))
  w.zeile('Kontoinhaber', s(sd.kontoinhaber))
  w.zeile('IBAN', s(sd.iban))
  if (sd.standort_plz || sd.standort_ort) {
    w.zeile('Standort der Maßnahme', `${s(sd.standort_strasse)}, ${s(sd.standort_plz)} ${s(sd.standort_ort)}`)
  }
  w.abstand(6)

  if (d.kmu) {
    w.ueberschrift(`4 · KMU-Bewertung (Geschäftsjahr ${d.kmu.geschaeftsjahr})`)
    w.zeile('Jahresarbeitseinheiten (JAE)', String(d.kmu.jae))
    w.zeile('Jahresumsatz', eur(d.kmu.umsatz))
    w.zeile('Bilanzsumme', eur(d.kmu.bilanzsumme))
    w.zeile(
      'Ergebnis (EU 2003/361/EG)',
      `${CATEGORY_LABELS[d.kmu.kategorie as Category] ?? d.kmu.kategorie} · Förderquote ${d.kmu.foerderquote_pct} %`,
    )
    w.abstand(4)
    if (d.beteiligungen.length > 0) {
      w.absatz('Berücksichtigte Partner-/verbundene Unternehmen:', 9.5)
      for (const b of d.beteiligungen) {
        w.zeile(
          `${b.name} (${b.richtung === 'aufwaerts' ? 'beteiligt an uns' : 'unsere Beteiligung'})`,
          `${b.anteil_pct} % · ${b.jae ?? '–'} JAE · Umsatz ${eur(b.umsatz)} · Bilanz ${eur(b.bilanzsumme)}`,
        )
      }
    }
    w.abstand(6)
  }

  w.ueberschrift(`${d.kmu ? 5 : 4} · De-minimis-Erklärung`)
  if (d.deminimis) {
    w.zeile('Fusion (3 Jahre)', jaNein(d.deminimis.fusion_3j))
    w.zeile('Unternehmensübernahme (3 Jahre)', jaNein(d.deminimis.uebernahme_3j))
    w.zeile('Aufspaltung (3 Jahre)', jaNein(d.deminimis.aufspaltung_3j))
    w.zeile('Beihilfen gesamt (3 Jahre)', eur(d.deminimis.summe_eur))
    w.zeile('Bestätigt am', new Date(d.deminimis.bestaetigt_at).toLocaleString('de-DE'))
    if (d.beihilfen.length > 0) {
      w.abstand(4)
      w.absatz('Angegebene De-minimis-Beihilfen:', 9.5)
      for (const b of d.beihilfen) {
        w.zeile(
          `${b.beihilfegeber}${b.aktenzeichen ? ` (${b.aktenzeichen})` : ''}`,
          `${eur(b.betrag)} · ${b.form} · bewilligt ${datumDE(b.bewilligt_am)} · ${b.status}`,
        )
      }
    }
  } else {
    w.absatz('Keine De-minimis-Erklärung hinterlegt.')
  }
  w.abstand(6)

  if (d.vollmacht) {
    w.ueberschrift(`${d.kmu ? 6 : 5} · Beantragungsweg und Vollmacht`)
    w.zeile(
      'Beantragungsweg',
      d.vollmacht.beantragungsweg === 'eskalator'
        ? 'Fördermittel-Concierge der Eskalator AG'
        : 'Beantragung durch das Unternehmen selbst',
    )
    if (d.vollmacht.unterzeichnet_von) {
      w.zeile(
        'Vollmacht erteilt durch',
        `${d.vollmacht.unterzeichnet_von}${
          d.vollmacht.unterzeichnet_at ? `, ${new Date(d.vollmacht.unterzeichnet_at).toLocaleString('de-DE')}` : ''
        }`,
      )
    }
    w.abstand(6)
  }

  w.abstand(8)
  w.absatz(
    'Hinweis: Diese Datenübersicht wurde automatisiert aus dem MABE Förderportal erstellt und gibt den ' +
      'Stand der gespeicherten Angaben wieder. Sie dient der Information des Antragstellers und der ' +
      'Ablage; maßgeblich für die Antragstellung sind die im FZD-Portal eingereichten Daten.',
    8.5,
  )

  w.fusszeile(`MABE Förderportal · Datenübersicht ${d.angebot.angebot_nr}`)
  return doc.save()
}
