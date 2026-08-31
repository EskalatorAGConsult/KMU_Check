import type { SchrittDef } from './types'

/**
 * DIE KLICKSTRECKE. Reihenfolge = Ablauf in der Kunden-Journey.
 * Aenderungen hier wirken sofort auf Wizard, Validierung und Fortschritt –
 * ohne weitere Code-Anpassungen.
 *
 * Fachliche Abbildung auf das Eskalator/n8n-Zielformular:
 *   'unternehmen' + 'ansprechpartner' + 'antrag' -> Tabelle stammdaten
 *   'kmu'        -> kmu_bewertungen + beteiligungen
 *   'deminimis'  -> deminimis_beihilfen + deminimis_erklaerungen
 *   'vollmacht'  -> vollmachten
 */
export const SCHRITTE: SchrittDef[] = [
  {
    id: 'uebersicht',
    titel: 'Ihr Förderprojekt',
    beschreibung: 'Ihr MABE-Angebot und die mögliche Förderung auf einen Blick.',
    komponente: 'uebersicht',
  },
  {
    id: 'unternehmen',
    titel: 'Ihr Unternehmen',
    beschreibung: 'Stammdaten des antragstellenden Unternehmens (Zuwendungsempfänger).',
    komponente: 'generisch',
    felder: [
      { name: 'unternehmensname', typ: 'text', label: 'Unternehmensname', pflicht: true },
      {
        name: 'land',
        typ: 'text',
        label: 'Land',
        pflicht: true,
        placeholder: 'Deutschland',
      },
      { name: 'plz', typ: 'plz', label: 'PLZ', pflicht: true },
      { name: 'ort', typ: 'text', label: 'Ort', pflicht: true },
      { name: 'strasse', typ: 'text', label: 'Straße + Hausnr.', pflicht: true },
      { name: 'email', typ: 'email', label: 'E-Mail (Unternehmen)', pflicht: true },
      {
        name: 'wz_code',
        typ: 'text',
        label: 'WZ-Code (2008)',
        pflicht: true,
        placeholder: 'z. B. 28.29',
        hilfe: 'Die Branchenklassifikation Ihres Unternehmens (WZ 2008). Sie steht z. B. im Handelsregisterauszug oder beim Steuerberater.',
      },
      {
        name: 'unternehmensart',
        typ: 'auswahl',
        label: 'Unternehmensart',
        pflicht: true,
        hilfe: 'Steht Ihr Unternehmen in Beteiligungsverhältnissen? Das wird im Schritt „Ihr KMU-Status“ konkret verrechnet.',
        optionen: [
          { wert: 'eigenstaendig', label: 'Eigenständiges Unternehmen' },
          { wert: 'partner', label: 'Partnerunternehmen' },
          { wert: 'verbunden', label: 'Verbundenes Unternehmen' },
        ],
      },
      {
        name: 'vorsteuerabzug',
        typ: 'auswahl',
        label: 'Vorsteuerabzugsberechtigt?',
        pflicht: true,
        hilfe: 'Förderfähig sind Netto-Kosten bei Vorsteuerabzug, sonst Brutto-Kosten.',
        optionen: [
          { wert: 'ja', label: 'Ja' },
          { wert: 'nein', label: 'Nein' },
        ],
      },
      {
        name: 'personenart',
        typ: 'auswahl',
        label: 'Antragsteller ist eine',
        pflicht: true,
        optionen: [
          { wert: 'juristisch', label: 'Juristische Person (z. B. GmbH, AG)' },
          { wert: 'natuerlich', label: 'Natürliche Person (z. B. Einzelunternehmer)' },
        ],
      },
      {
        name: 'geburtsdatum',
        typ: 'datum',
        label: 'Geburtsdatum',
        sichtbarWenn: { feld: 'personenart', ist: 'natuerlich' },
        pflicht: true,
      },
      {
        name: 'steuer_id',
        typ: 'text',
        label: 'Steuer-ID (11-stellig)',
        sichtbarWenn: { feld: 'personenart', ist: 'natuerlich' },
        pflicht: true,
      },
      {
        name: 'steuernummer',
        typ: 'text',
        label: 'Steuernummer',
        sichtbarWenn: { feld: 'personenart', ist: 'juristisch' },
        pflicht: true,
        hilfe: 'Die Steuernummer des Unternehmens (nicht die USt-IdNr.), Format z. B. 123/456/78901.',
      },
    ],
  },
  {
    id: 'ansprechpartner',
    titel: 'Ihr Ansprechpartner',
    beschreibung: 'Wer ist fachlich für dieses Vorhaben zuständig?',
    komponente: 'generisch',
    felder: [
      {
        name: 'ap_rolle',
        typ: 'text',
        label: 'Rolle / Position',
        pflicht: true,
        placeholder: 'z. B. Geschäftsführung, Energiemanagement',
      },
      {
        name: 'ap_anrede',
        typ: 'auswahl',
        label: 'Anrede',
        pflicht: true,
        optionen: [
          { wert: 'Frau', label: 'Frau' },
          { wert: 'Herr', label: 'Herr' },
          { wert: 'Keine Angabe', label: 'Keine Angabe' },
        ],
      },
      { name: 'ap_vorname', typ: 'text', label: 'Vorname', pflicht: true },
      { name: 'ap_nachname', typ: 'text', label: 'Nachname', pflicht: true },
      { name: 'ap_email', typ: 'email', label: 'E-Mail (Ansprechpartner)', pflicht: true },
    ],
  },
  {
    id: 'kmu',
    titel: 'Ihr KMU-Status',
    beschreibung: 'Bestimmt Ihre Förderquote: 45 % (klein), 35 % (mittel), 25 % (ohne KMU-Status).',
    komponente: 'kmu',
  },
  {
    id: 'deminimis',
    titel: 'De-minimis-Erklärung',
    beschreibung: 'Beihilfen der letzten drei Jahre – gesetzlich vorgeschriebene Angabe (VO (EU) 2023/2831).',
    komponente: 'deminimis',
  },
  {
    id: 'antrag',
    titel: 'Antragsdaten & Bankverbindung',
    beschreibung: 'Angaben zum Antrag, Standort der Maßnahme und Konto für die Auszahlung.',
    komponente: 'generisch',
    felder: [
      {
        name: 'gruppenzugehoerigkeit',
        typ: 'auswahl',
        label: 'Gruppenzugehörigkeit',
        pflicht: true,
        optionen: [
          { wert: 'privat', label: 'Privates Unternehmen' },
          { wert: 'kommunal', label: 'Kommunales Unternehmen' },
          { wert: 'land', label: 'Landesunternehmen' },
          { wert: 'freiberuflich', label: 'Freiberuflich Tätige' },
          { wert: 'contractor', label: 'Contractor' },
        ],
      },
      {
        name: 'wirtschaftlich_taetig',
        typ: 'auswahl',
        label: 'Wirtschaftlich tätig?',
        pflicht: true,
        hilfe: 'Wirtschaftlich tätig ist, wer Waren oder Dienstleistungen am Markt anbietet.',
        optionen: [
          { wert: 'ja', label: 'Ja' },
          { wert: 'nein', label: 'Nein' },
        ],
      },
      {
        name: 'standort_plz',
        typ: 'plz',
        label: 'Standort der Maßnahme: PLZ',
        hilfe: 'Nur ausfüllen, wenn der Installationsort von der Firmenadresse abweicht.',
      },
      { name: 'standort_ort', typ: 'text', label: 'Standort: Ort' },
      { name: 'standort_strasse', typ: 'text', label: 'Standort: Straße' },
      { name: 'kontoinhaber', typ: 'text', label: 'Kontoinhaber (Vor- & Nachname)', pflicht: true },
      {
        name: 'iban',
        typ: 'iban',
        label: 'IBAN',
        pflicht: true,
        hilfe: 'Konto des Antragstellers für die Auszahlung des Zuschusses.',
      },
    ],
  },
  {
    id: 'vollmacht',
    titel: 'Vollmacht & Beantragung',
    beschreibung: 'Wer soll Ihren Antrag stellen – und die abschließenden Bestätigungen.',
    komponente: 'vollmacht',
  },
]

export const SCHRITT_IDS = SCHRITTE.map((s) => s.id)
export type SchrittId = (typeof SCHRITT_IDS)[number]

export function schrittNach(id: string): SchrittDef | undefined {
  return SCHRITTE.find((s) => s.id === id)
}
