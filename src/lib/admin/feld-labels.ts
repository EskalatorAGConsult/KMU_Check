/**
 * Deutsche Feldnamen fuer Angebots- und Stammdatenfelder.
 * Geteilt zwischen Admin-Bearbeitungsformular, Aenderungshistorie (UI)
 * und dem Fallakte-PDF (Audit-Report) – Single Source of Truth.
 */
export const FELD_LABEL: Record<string, string> = {
  status: 'Status',
  kunde_firma: 'Kundenfirma',
  kunde_ansprechpartner: 'Ansprechpartner (Kunde)',
  kunde_email: 'E-Mail (Kunde)',
  angebot_nr: 'Angebotsnummer',
  angebot_datum: 'Angebotsdatum',
  technologien: 'Technologien',
  software_variante: 'Software-Variante',
  invest_software: 'Invest Software (EUR)',
  invest_messtechnik: 'Invest Messtechnik (EUR)',
  invest_steuerung: 'Invest Steuerung (EUR)',
  sensoren_gesamt: 'Sensoren gesamt',
  sensoren_prozessbezug: 'Sensoren mit Prozessbezug',
  projektende: 'Projektende',
  notiz: 'Interne Notiz',
  unternehmensname: 'Unternehmensname',
  land: 'Land',
  plz: 'PLZ',
  ort: 'Ort',
  strasse: 'Straße + Hausnr.',
  email: 'E-Mail (Unternehmen)',
  wz_code: 'WZ-Code',
  ust_id: 'USt-IdNr.',
  steuernummer: 'Steuernummer',
  steuer_id: 'Steuer-ID',
  geburtsdatum: 'Geburtsdatum',
  unternehmensart: 'Unternehmensart',
  personenart: 'Personenart',
  vorsteuerabzug: 'Vorsteuerabzug',
  gruppenzugehoerigkeit: 'Gruppenzugehörigkeit',
  wirtschaftlich_taetig: 'Wirtschaftlich tätig',
  ap_rolle: 'AP-Rolle',
  ap_anrede: 'AP-Anrede',
  ap_vorname: 'AP-Vorname',
  ap_nachname: 'AP-Nachname',
  ap_email: 'AP-E-Mail',
  kontoinhaber: 'Kontoinhaber',
  iban: 'IBAN',
  standort_plz: 'Standort-PLZ',
  standort_ort: 'Standort-Ort',
  standort_strasse: 'Standort-Straße',
}

/** Label fuer ein Feld (Fallback: technischer Name). */
export function feldLabel(feld: string): string {
  return FELD_LABEL[feld] ?? feld
}
