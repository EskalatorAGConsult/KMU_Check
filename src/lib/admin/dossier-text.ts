import type {
  Angebot,
  BeteiligungRow,
  DeminimisBeihilfeRow,
  DeminimisErklaerungRow,
  KmuBewertungRow,
  StammdatenRow,
  VollmachtRow,
} from '@/lib/db/types'
import { CATEGORY_LABELS, formatEUR, type Category, type KmuResult } from '@/lib/kmu'
import {
  BEANTRAGUNGSWEG_LABELS,
  BEIHILFE_FORM_LABELS,
  BEIHILFE_STATUS_LABELS,
  BETEILIGUNG_RICHTUNG_LABELS,
  GRUPPENZUGEHOERIGKEIT_LABELS,
  PERSONENART_LABELS,
  SOFTWARE_VARIANTE_LABELS,
  TECHNOLOGIE_LABELS,
  UNTERNEHMENSART_LABELS,
} from '@/lib/labels'

/**
 * Baut den kompletten Datenauszug eines Vorgangs als kopierfaehigen
 * Klartext – exakt in der Reihenfolge des BAFA-Modul-3-Formulars, damit
 * Vertrieb/Eskalator die Werte direkt ins FZD-Portal uebertragen koennen.
 * Reine Funktion (kein I/O) -> unit-getestet.
 */

export interface DossierTextEingabe {
  angebot: Angebot
  stammdaten: StammdatenRow | null
  beteiligungen: BeteiligungRow[]
  kmuBewertungen: KmuBewertungRow[]
  deminimis: DeminimisErklaerungRow | null
  beihilfen: DeminimisBeihilfeRow[]
  vollmacht: VollmachtRow | null
}

const fehlt = '–'

function s(v: unknown): string {
  return v == null || v === '' ? fehlt : String(v)
}

function eur(v: number | null | undefined): string {
  return v == null ? fehlt : formatEUR(v)
}

function datum(iso: string | null | undefined): string {
  if (!iso) return fehlt
  return new Date(iso).toLocaleDateString('de-DE')
}

function zeitstempel(iso: string | null | undefined): string {
  if (!iso) return fehlt
  return new Date(iso).toLocaleString('de-DE')
}

function jaNein(v: boolean | null | undefined): string {
  return v == null ? fehlt : v ? 'ja' : 'nein'
}

export function baueDossierText(e: DossierTextEingabe): string {
  const { angebot: a, stammdaten: sd } = e
  const invest =
    (a.invest_software ?? 0) + (a.invest_messtechnik ?? 0) + (a.invest_steuerung ?? 0)
  const kmuAktuell = e.kmuBewertungen[0] ?? null // Repo liefert absteigend nach Geschaeftsjahr
  const berechnung = (kmuAktuell?.berechnung ?? null) as KmuResult | null

  const z: string[] = []
  const zeile = (label: string, wert: string) => z.push(`${label}: ${wert}`)

  z.push('BAFA EEW MODUL 3 – DATENAUSZUG (MABE Förderportal)')
  zeile('Vorgang / Angebot', `${a.angebot_nr} vom ${datum(a.angebot_datum)}`)
  zeile('Stand', zeitstempel(new Date().toISOString()))
  z.push('')

  z.push('1 · UNTERNEHMEN (Zuwendungsempfänger)')
  if (sd) {
    zeile('Unternehmensname', sd.unternehmensname)
    zeile('Land', sd.land)
    zeile('PLZ / Ort', `${sd.plz} ${sd.ort}`)
    zeile('Straße + Hausnr.', sd.strasse)
    zeile('E-Mail', sd.email)
    zeile('WZ-Code (2008)', sd.wz_code)
    zeile('Unternehmensart', UNTERNEHMENSART_LABELS[sd.unternehmensart])
    zeile('Vorsteuerabzugsberechtigt', jaNein(sd.vorsteuerabzug))
    zeile('Antragsteller ist eine', PERSONENART_LABELS[sd.personenart])
    if (sd.personenart === 'natuerlich') {
      zeile('Geburtsdatum', datum(sd.geburtsdatum))
      zeile('Steuer-ID (11-stellig)', s(sd.steuer_id))
    } else {
      zeile('Steuernummer', s(sd.steuernummer))
      zeile('USt-IdNr.', s(sd.ust_id))
    }
  } else {
    z.push(`${fehlt} noch nicht eingereicht`)
  }
  z.push('')

  z.push('2 · ANSPRECHPARTNER')
  if (sd) {
    zeile('Rolle', s(sd.ap_rolle))
    zeile('Anrede', s(sd.ap_anrede))
    zeile('Vorname', s(sd.ap_vorname))
    zeile('Nachname', s(sd.ap_nachname))
    zeile('E-Mail (Ansprechpartner)', s(sd.ap_email))
  } else {
    z.push(fehlt)
  }
  z.push('')

  z.push('3 · ANGABEN ZUM ANTRAG')
  if (sd) {
    zeile('Gruppenzugehörigkeit', GRUPPENZUGEHOERIGKEIT_LABELS[sd.gruppenzugehoerigkeit])
    zeile('Wirtschaftlich tätig', jaNein(sd.wirtschaftlich_taetig))
    zeile('Vorhaben noch nicht begonnen', jaNein(sd.vorhaben_nicht_begonnen))
    zeile('DSGVO-Einwilligung', zeitstempel(sd.dsgvo_einwilligung_at))
  } else {
    z.push(fehlt)
  }
  z.push('')

  z.push('4 · BANKVERBINDUNG')
  if (sd) {
    zeile('Kontoinhaber', s(sd.kontoinhaber))
    zeile('IBAN', s(sd.iban))
  } else {
    z.push(fehlt)
  }
  z.push('')

  z.push('5 · KMU-EINSTUFUNG (EU 2003/361/EG)')
  if (e.kmuBewertungen.length > 0) {
    for (const k of e.kmuBewertungen) {
      zeile(
        `Geschäftsjahr ${k.geschaeftsjahr}${k.abgeschlossen ? '' : ' (nicht abgeschlossen)'}`,
        `${k.jae ?? fehlt} JAE · Umsatz ${eur(k.umsatz)} · Bilanzsumme ${eur(k.bilanzsumme)}`,
      )
      if (k.kategorie) {
        zeile(
          `Ergebnis ${k.geschaeftsjahr}`,
          `${CATEGORY_LABELS[k.kategorie as Category] ?? k.kategorie} · Förderquote ${k.foerderquote_pct ?? fehlt} %`,
        )
      }
    }
    if (berechnung) {
      zeile(
        'Konsolidierte Werte (inkl. Verbund)',
        `${Math.round(berechnung.consolidated.employees * 10) / 10} JAE · Umsatz ${eur(berechnung.consolidated.turnover)} · Bilanz ${eur(berechnung.consolidated.balanceSheet)}`,
      )
    }
  } else {
    z.push(fehlt)
  }
  if (e.beteiligungen.length > 0) {
    z.push('Partner-/verbundene Unternehmen:')
    for (const b of e.beteiligungen) {
      const zurechnung = b.anteil_pct > 50 ? '100 % Zurechnung (verbunden)' : `anteilig ${b.anteil_pct} % (Partner)`
      const kette = b.stufe && b.stufe > 1 ? ` · Kette Stufe ${b.stufe}${b.pfad ? ` (${b.pfad})` : ''}` : ''
      z.push(
        `  - ${b.name} · ${BETEILIGUNG_RICHTUNG_LABELS[b.richtung]} · ${b.anteil_pct} % · ${zurechnung} · ` +
          `${b.jae ?? fehlt} JAE · Umsatz ${eur(b.umsatz)} · Bilanz ${eur(b.bilanzsumme)} · Quelle: ${b.quelle}${kette}`,
      )
    }
  }
  z.push('')

  z.push('6 · STANDORT DER MASSNAHME')
  if (sd && (sd.standort_plz || sd.standort_ort || sd.standort_strasse)) {
    zeile('Standort', `${s(sd.standort_strasse)}, ${s(sd.standort_plz)} ${s(sd.standort_ort)}`)
  } else {
    z.push('Wie Firmenanschrift (kein abweichender Standort angegeben)')
  }
  z.push('')

  z.push('7 · TECHNISCHE MASSNAHME (aus MABE-Angebot)')
  zeile('Technologien', a.technologien.map((t) => TECHNOLOGIE_LABELS[t]).join(', '))
  if (a.software_variante) zeile('Software-Variante', SOFTWARE_VARIANTE_LABELS[a.software_variante])
  zeile('Investitionsgesamtkosten Energiemanagementsoftware', eur(a.invest_software))
  zeile('Investitionsgesamtkosten Mess- und Sensortechnik', eur(a.invest_messtechnik))
  zeile('Investitionsgesamtkosten Steuerungs- und Regelungstechnik', eur(a.invest_steuerung))
  zeile('Investition gesamt', eur(invest))
  zeile('Anzahl beantragter Sensoren', s(a.sensoren_gesamt))
  zeile('davon mit Prozessbezug', s(a.sensoren_prozessbezug))
  zeile('Voraussichtliches Projektende', datum(a.projektende))
  if (kmuAktuell?.foerderquote_pct && invest > 0) {
    zeile(
      'Voraussichtlicher Zuschuss',
      `${formatEUR((invest * kmuAktuell.foerderquote_pct) / 100)} (${kmuAktuell.foerderquote_pct} % von ${formatEUR(invest)})`,
    )
  }
  z.push('')

  z.push('8 · DE-MINIMIS-ERKLÄRUNG (VO (EU) 2023/2831)')
  if (e.deminimis) {
    zeile('Fusion in den letzten 3 Jahren', jaNein(e.deminimis.fusion_3j))
    zeile('Unternehmensübernahme in den letzten 3 Jahren', jaNein(e.deminimis.uebernahme_3j))
    zeile('Aufspaltung in den letzten 3 Jahren', jaNein(e.deminimis.aufspaltung_3j))
    zeile('De-minimis-Beihilfen gesamt (3 Jahre)', eur(e.deminimis.summe_eur))
    zeile('Bestätigt am', zeitstempel(e.deminimis.bestaetigt_at))
    for (const b of e.beihilfen) {
      z.push(
        `  - ${b.beihilfegeber}${b.aktenzeichen ? ` (${b.aktenzeichen})` : ''} · ${eur(b.betrag)} · ` +
          `${BEIHILFE_FORM_LABELS[b.form]} · ${BEIHILFE_STATUS_LABELS[b.status]} · bewilligt ${datum(b.bewilligt_am)}`,
      )
    }
  } else {
    z.push(fehlt)
  }
  z.push('')

  z.push('9 · VOLLMACHT & BEANTRAGUNGSWEG')
  if (e.vollmacht) {
    zeile('Beantragungsweg', BEANTRAGUNGSWEG_LABELS[e.vollmacht.beantragungsweg])
    if (e.vollmacht.beantragungsweg === 'eskalator') {
      zeile('Vollmacht unterzeichnet von', s(e.vollmacht.unterzeichnet_von))
      zeile('Unterzeichnet am', zeitstempel(e.vollmacht.unterzeichnet_at))
    }
  } else {
    z.push(fehlt)
  }

  return z.join('\n')
}
