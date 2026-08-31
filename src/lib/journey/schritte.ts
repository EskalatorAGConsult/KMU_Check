import type { SchrittDef } from './types'

/**
 * DIE KLICKSTRECKE. Reihenfolge = Ablauf in der Kunden-Journey.
 * Aenderungen hier wirken sofort auf Wizard, Validierung und Fortschritt –
 * ohne weitere Code-Anpassungen.
 *
 * - `kurz`: Label in der Fortschrittsanzeige
 * - `erklaerung`: Laien-Info-Box oben im Schritt („Warum fragen wir das?")
 * - `tooltip` am Feld: ⓘ-Erklaerung direkt am Label
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
    kurz: 'Übersicht',
    beschreibung: 'Ihr MABE-Angebot und die mögliche Förderung auf einen Blick.',
    erklaerung:
      'Gute Nachricht vorab: Für das angebotene Vorhaben können Sie einen staatlichen Zuschuss erhalten – das ist Geld, das Sie nicht zurückzahlen. Dieser Assistent führt Sie in wenigen Schritten durch alle Angaben, die dafür nötig sind.',
    komponente: 'uebersicht',
  },
  {
    id: 'unternehmen',
    titel: 'Ihr Unternehmen',
    kurz: 'Unternehmen',
    beschreibung: 'Stammdaten des antragstellenden Unternehmens (Zuwendungsempfänger).',
    erklaerung:
      'Der Zuschuss wird offiziell an Ihr Unternehmen gezahlt. Deshalb brauchen wir die Daten exakt so, wie sie im Handelsregister bzw. bei Ihrem Finanzamt hinterlegt sind.',
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
        tooltip:
          'Der WZ-Code ist eine Nummer für Ihre Branche (ähnlich wie eine Artikelnummer für Wirtschaftszweige). Sie steht auf Ihrem Fragebogen zur steuerlichen Erfassung oder im Handelsregisterauszug. Ihr Steuerbüro nennt ihn Ihnen in einer Minute.',
      },
      {
        name: 'unternehmensart',
        typ: 'auswahl',
        label: 'Unternehmensart',
        pflicht: true,
        hilfe: 'Steht Ihr Unternehmen in Beteiligungsverhältnissen? Das wird im Schritt „Ihr KMU-Status“ konkret verrechnet.',
        tooltip:
          '„Partner“ oder „verbunden“ heißt: Ein anderes Unternehmen hält mindestens 25 % Ihrer Anteile – oder Sie halten mindestens 25 % an einem anderen. Wenn das nicht der Fall ist, wählen Sie „eigenständig“.',
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
        tooltip:
          'Fast alle Unternehmen sind vorsteuerabzugsberechtigt – das heißt: Sie bekommen die Mehrwertsteuer auf Einkäufe vom Finanzamt zurück. Dann wählen Sie „Ja“. Unsicher? Ein Blick in die letzte Umsatzsteuervoranmeldung oder ein Anruf beim Steuerbüro genügt.',
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
        tooltip:
          'GmbH, AG, UG & Co. sind „juristische Personen“. Einzelunternehmer und Freiberufler wählen „natürliche Person“.',
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
        tooltip:
          'Ihre persönliche steuerliche Identifikationsnummer (11 Ziffern). Sie steht auf jedem Einkommensteuerbescheid und auf der Lohnabrechnung.',
      },
      {
        name: 'steuernummer',
        typ: 'text',
        label: 'Steuernummer',
        sichtbarWenn: { feld: 'personenart', ist: 'juristisch' },
        pflicht: true,
        hilfe: 'Die Steuernummer des Unternehmens (nicht die USt-IdNr.), Format z. B. 123/456/78901.',
        tooltip:
          'Die Steuernummer hat Ihr Unternehmen vom Finanzamt erhalten – sie steht auf jedem Schreiben des Finanzamts. Nicht verwechseln mit der USt-IdNr. (beginnt mit „DE“).',
      },
    ],
  },
  {
    id: 'ansprechpartner',
    titel: 'Ihr Ansprechpartner',
    kurz: 'Kontakt',
    beschreibung: 'Wer ist fachlich für dieses Vorhaben zuständig?',
    erklaerung:
      'Für Rückfragen der Bewilligungsstelle brauchen wir eine feste Kontaktperson in Ihrem Unternehmen – idealerweise jemand, der das Projekt fachlich kennt.',
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
    kurz: 'KMU-Status',
    beschreibung: 'Bestimmt Ihre Förderquote: 45 % (klein), 35 % (mittel), 25 % (ohne KMU-Status).',
    erklaerung:
      'Die Höhe Ihres Zuschusses hängt davon ab, wie groß Ihr Unternehmen ist – das prüft der Staat anhand fester EU-Grenzen („KMU“ = kleine und mittlere Unternehmen). Tragen Sie hier Ihre Zahlen ein, die Ampel zeigt Ihnen sofort live Ihre voraussichtliche Förderquote und Fördersumme.',
    komponente: 'kmu',
  },
  {
    id: 'deminimis',
    titel: 'De-minimis-Erklärung',
    kurz: 'De-minimis',
    beschreibung: 'Beihilfen der letzten drei Jahre – gesetzlich vorgeschriebene Angabe (VO (EU) 2023/2831).',
    erklaerung:
      'Der Staat muss sicherstellen, dass ein Unternehmen nicht zu viele kleine Förderungen sammelt. Deshalb listen Sie hier alle staatlichen „De-minimis“-Zuschüsse der letzten drei Jahre auf. Sie erkennen diese an der „De-minimis-Bescheinigung“ in den Förderunterlagen.',
    komponente: 'deminimis',
  },
  {
    id: 'antrag',
    titel: 'Antragsdaten & Bankverbindung',
    kurz: 'Antrag & Bank',
    beschreibung: 'Angaben zum Antrag, Standort der Maßnahme und Konto für die Auszahlung.',
    erklaerung:
      'Fast geschafft: Jetzt brauchen wir nur noch ein paar Antragsformalitäten und das Konto, auf das der Zuschuss nach Bewilligung überwiesen werden soll.',
    komponente: 'generisch',
    felder: [
      {
        name: 'gruppenzugehoerigkeit',
        typ: 'auswahl',
        label: 'Gruppenzugehörigkeit',
        pflicht: true,
        tooltip:
          'Die Antragsstatistik des Bundes unterscheidet, wem das Unternehmen gehört. Die allermeisten Antragsteller wählen hier „Privates Unternehmen“.',
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
        tooltip:
          'Wenn Ihr Unternehmen Produkte verkauft oder Dienstleistungen gegen Geld anbietet, wählen Sie „Ja“. Nur reine Idealvereine o. Ä. sind nicht wirtschaftlich tätig.',
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
        tooltip:
          'Die IBAN Ihres Firmenkontos (beginnt mit „DE“, 22 Stellen). Von diesem Konto muss auch die Investition bezahlt werden – die Bewilligungsstelle gleicht das später ab.',
      },
    ],
  },
  {
    id: 'vollmacht',
    titel: 'Vollmacht & Beantragung',
    kurz: 'Vollmacht',
    beschreibung: 'Wer soll Ihren Antrag stellen – und die abschließenden Bestätigungen.',
    erklaerung:
      'Letzter Schritt: Sie entscheiden, ob der Fördermittel-Concierge der Eskalator AG den Antrag komplett für Sie übernimmt (empfohlen – inklusive aller Rückfragen der Behörde) oder ob Sie ihn selbst einreichen möchten.',
    komponente: 'vollmacht',
  },
]

export const SCHRITT_IDS = SCHRITTE.map((s) => s.id)
export type SchrittId = (typeof SCHRITT_IDS)[number]

export function schrittNach(id: string): SchrittDef | undefined {
  return SCHRITTE.find((s) => s.id === id)
}
