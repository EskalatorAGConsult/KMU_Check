import 'server-only'

import type { Angebot, Technologie } from '@/lib/db/types'
import { CATEGORY_LABELS, type Category } from '@/lib/kmu'
import { Writer, datumDE, eur, neuesPdfDokument } from '@/lib/pdf/writer'

/**
 * Generiert das MABE-Standard-Systemkonzept (PDF) fuer BAFA Modul 3.
 *
 * Fachliche Grundlage (Merkblatt EEW, Modul 3 „Energiemanagementsysteme"):
 * - Systemkonzept: beschreibt Datenerfassung, Sensorintegration und die
 *   Einbindung der Messtechnik in die EMS-Software (Merkblatt Kap. 3.1).
 * - Datenerfassungsplan nach DIN EN ISO 50015 (Messstellen, Prozessbezug).
 * - Bei Steuerungstechnik zusaetzlich Wirkplan (Begriffe DIN IEC 60050-351).
 * - Software muss BAFA-gelistet sein und den PDCA-Zyklus nach DIN EN ISO 50001
 *   abbilden; Energiekennzahlen sind mindestens 3 Jahre zu speichern.
 *
 * Die Textbausteine sind MABE-Standardformulierungen und koennen bei Bedarf
 * durch ein individuelles MABE-Template ersetzt werden.
 */

const TECHNOLOGIE_LABELS: Record<Technologie, string> = {
  software: 'Energiemanagement-Software (MABE smart control)',
  messtechnik: 'Mess- und Sensorik zur Energiedatenerfassung',
  steuerung: 'Steuerungstechnik (MSR)',
}

export interface SystemkonzeptStammdaten {
  unternehmensname: string
  strasse: string
  plz: string
  ort: string
  land: string
  wz_code: string
  ap_rolle: string
  ap_vorname: string
  ap_nachname: string
  standort_strasse?: string | null
  standort_plz?: string | null
  standort_ort?: string | null
}

export interface SystemkonzeptKmu {
  kategorie: Category
  foerderquotePct: number
}

export type SystemkonzeptAngebot = Pick<
  Angebot,
  | 'angebot_nr'
  | 'angebot_datum'
  | 'technologien'
  | 'invest_software'
  | 'invest_messtechnik'
  | 'invest_steuerung'
  | 'sensoren_gesamt'
  | 'sensoren_prozessbezug'
  | 'projektende'
>

export async function generiereSystemkonzept(
  angebot: SystemkonzeptAngebot,
  stammdaten: SystemkonzeptStammdaten,
  kmu: SystemkonzeptKmu,
): Promise<Uint8Array> {
  const { doc, fett, normal } = await neuesPdfDokument(
    `Systemkonzept ${angebot.angebot_nr}`,
    'Systemkonzept – BAFA EEW Modul 3 (Energiemanagementsysteme)',
  )
  const w = new Writer(doc, fett, normal)

  w.kopf('Systemkonzept', 'Energiemanagement- und Energiemonitoringsystem nach DIN EN ISO 50001', [
    'BAFA-Programm „Energie- und Ressourceneffizienz in der Wirtschaft (EEW)"',
    `Modul 3: Energiemanagementsysteme · Erstellt am ${datumDE(new Date().toISOString())}`,
  ])

  // 1 · Antragsteller
  w.ueberschrift('1 · Antragsteller')
  w.zeile('Unternehmen', stammdaten.unternehmensname)
  w.zeile('Anschrift', `${stammdaten.strasse}, ${stammdaten.plz} ${stammdaten.ort}, ${stammdaten.land}`)
  w.zeile('WZ-Code (Branche)', stammdaten.wz_code)
  w.zeile('Ansprechpartner', `${stammdaten.ap_vorname} ${stammdaten.ap_nachname} (${stammdaten.ap_rolle})`)
  w.zeile(
    'KMU-Einstufung (EU 2003/361/EG)',
    `${CATEGORY_LABELS[kmu.kategorie] ?? kmu.kategorie} · Förderquote ${kmu.foerderquotePct} %`,
  )
  w.abstand(6)

  // 2 · Vorhaben
  const investition =
    (angebot.invest_software ?? 0) + (angebot.invest_messtechnik ?? 0) + (angebot.invest_steuerung ?? 0)
  const standort =
    stammdaten.standort_plz || stammdaten.standort_ort
      ? `${stammdaten.standort_strasse ?? ''}, ${stammdaten.standort_plz ?? ''} ${stammdaten.standort_ort ?? ''}`.trim()
      : `${stammdaten.strasse}, ${stammdaten.plz} ${stammdaten.ort}`
  w.ueberschrift('2 · Vorhabenübersicht')
  w.zeile('Angebot', `${angebot.angebot_nr} vom ${datumDE(angebot.angebot_datum)}`)
  w.zeile('Standort der Maßnahme', standort)
  w.zeile('Geplantes Projektende', datumDE(angebot.projektende))
  w.zeile('Investitionssumme (netto)', eur(investition))
  w.abstand(4)
  w.absatz(
    `Gegenstand des Vorhabens ist die Einführung eines Energiemanagement- und Energiemonitoringsystems. ` +
      `Folgende Komponenten werden umgesetzt: ${angebot.technologien
        .map((t) => TECHNOLOGIE_LABELS[t])
        .join('; ')}.`,
  )

  // 3 · Software
  w.ueberschrift('3 · Energiemanagementsoftware')
  w.absatz(
    'Zum Einsatz kommt die Software „MABE smart control" der MABE Maschinen- und Behälterbau GmbH. ' +
      'Die Software ist im BAFA-Verzeichnis förderfähiger Energiemanagementsoftware gelistet und bildet den ' +
      'PDCA-Zyklus (Plan – Do – Check – Act) nach DIN EN ISO 50001 vollständig ab. Sie erfasst, visualisiert ' +
      'und analysiert Energieverbräuche und Energiekennzahlen und unterstützt die Ableitung sowie die ' +
      'Erfolgskontrolle von Effizienzmaßnahmen.',
  )

  // 4 · Datenerfassungsplan (DIN EN ISO 50015)
  w.ueberschrift('4 · Datenerfassungsplan nach DIN EN ISO 50015')
  w.zeile('Messstellen gesamt', angebot.sensoren_gesamt != null ? String(angebot.sensoren_gesamt) : '–')
  w.zeile(
    'davon mit Prozessbezug',
    angebot.sensoren_prozessbezug != null ? String(angebot.sensoren_prozessbezug) : '–',
  )
  w.abstand(4)
  w.absatz(
    'Die Messstellen erfassen die wesentlichen Energieeinsätze des Standorts (elektrische Energie sowie, ' +
      'sofern vorhanden, weitere Energieträger wie Gas, Wärme, Druckluft oder Wasser). Messwerte werden ' +
      'automatisiert in kurzen Intervallen erfasst und an die Energiemanagementsoftware übertragen. ' +
      'Der Prozessbezug der Messstellen ermöglicht die Zuordnung der Verbräuche zu Produktionsprozessen ' +
      'und die Bildung aussagekräftiger Energieleistungskennzahlen (EnPIs).',
  )

  // 5 · Systemarchitektur
  w.ueberschrift('5 · Systemarchitektur und Einbindung')
  w.absatz(
    'Die Sensorik wird über geeignete Schnittstellen (u. a. Modbus, M-Bus, S0-Impuls oder IO-Link) an ' +
      'Datenlogger angebunden. Die Datenlogger übermitteln die Messwerte gesichert an die zentrale ' +
      'Energiemanagementsoftware „MABE smart control", in der die Daten validiert, aggregiert und ' +
      'visualisiert werden. Das Systemkonzept beschreibt damit die vollständige Kette von der ' +
      'Datenerfassung über die Sensorintegration bis zur Einbindung in die EMS-Software.',
  )

  // 6 · MSR / Wirkplan – nur bei Steuerungstechnik
  if (angebot.technologien.includes('steuerung')) {
    w.ueberschrift('6 · Steuerungstechnik (MSR) und Wirkplan')
    w.absatz(
      'Das Vorhaben umfasst Mess-, Steuerungs- und Regelungstechnik (MSR). Die Wirkzusammenhänge der ' +
        'Steuerungstechnik werden in einem Wirkplan dokumentiert; die verwendeten Begriffe folgen der ' +
        'DIN IEC 60050-351. Die Steuerungstechnik ist in die Energiemanagementsoftware eingebunden, ' +
        'sodass Sollwerte, Regelabweichungen und Wirkungen von Stellgrößen energierelevant ausgewertet ' +
        'werden können.',
    )
  }

  // 7 · Betrieb und Speicherung
  w.ueberschrift(`${angebot.technologien.includes('steuerung') ? 7 : 6} · Betrieb und Datenspeicherung`)
  w.absatz(
    'Die Energiekennzahlen und Messdaten werden mindestens drei Jahre in der Energiemanagementsoftware ' +
      'gespeichert und stehen für Audits sowie für die Erfolgskontrolle nach DIN EN ISO 50001 zur ' +
      'Verfügung. Das System wird nach Inbetriebnahme dauerhaft betrieben; die Verwendungsnachweisführung ' +
      'erfolgt über die exportierbaren Berichte der Software.',
  )

  w.abstand(10)
  w.absatz(
    'Hinweis: Dieses Systemkonzept wurde automatisiert aus dem MABE Förderportal erstellt. Es basiert auf ' +
      'den Angaben des Antragstellers im Förderportal sowie auf dem Angebot der MABE Maschinen- und ' +
      'Behälterbau GmbH. Maßgeblich für die Antragstellung sind die Vorgaben des aktuellen BAFA-Merkblatts ' +
      'Energieeffizienz (EEW), Modul 3.',
    8.5,
  )

  w.fusszeile('MABE Maschinen- und Behälterbau GmbH · Standard-Systemkonzept BAFA Modul 3')
  return doc.save()
}
