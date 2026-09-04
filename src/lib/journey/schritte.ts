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
      'Gute Nachricht vorab: Für das angebotene Vorhaben können Sie einen staatlichen Zuschuss erhalten – das ist Geld, das Sie nicht zurückzahlen. In ca. 10 Minuten sind Sie durch – ich führe Sie Schritt für Schritt, Sie können jederzeit pausieren.',
    komponente: 'uebersicht',
  },
  {
    id: 'unternehmen',
    titel: 'Ihr Unternehmen',
    kurz: 'Unternehmen',
    beschreibung: 'Die offiziellen Daten Ihres Unternehmens – genau so, wie sie im Handelsregister oder beim Finanzamt stehen.',
    erklaerung:
      'Der Zuschuss wird offiziell an Ihr Unternehmen gezahlt. Deshalb brauchen wir die Daten exakt so, wie sie im Handelsregister bzw. bei Ihrem Finanzamt hinterlegt sind.',
    komponente: 'generisch',
    registerSuche: true,
    felder: [
      { name: 'unternehmensname', typ: 'text', label: 'Unternehmensname', pflicht: true, gruppe: 'Unternehmen & Adresse' },
      {
        name: 'land',
        typ: 'auswahl',
        label: 'Land',
        pflicht: true,
        standard: 'Deutschland',
        hilfe: 'Förderfähig sind nur Unternehmen mit Sitz in Deutschland (BAFA = Bundesprogramm).',
        tooltip:
          'Das BAFA ist eine Bundesförderung: Der Zuschuss geht nur an Unternehmen mit Sitz und Umsetzungsstandort in Deutschland. Deshalb ist hier „Deutschland“ fest vorgegeben.',
        optionen: [{ wert: 'Deutschland', label: 'Deutschland' }],
      },
      { name: 'plz', typ: 'plz', label: 'PLZ', pflicht: true },
      { name: 'ort', typ: 'text', label: 'Ort', pflicht: true },
      { name: 'strasse', typ: 'text', label: 'Straße + Hausnr.', pflicht: true },
      { name: 'email', typ: 'email', label: 'E-Mail (Unternehmen)', pflicht: true },
      {
        name: 'wz_code',
        typ: 'wz_code',
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
        label: 'Steht Ihr Unternehmen in Beteiligungsverhältnissen?',
        pflicht: true,
        gruppe: 'Rechtsform & Steuern',
        hilfe: 'Wenn ja, wird das im Schritt „Ihr KMU-Status“ konkret verrechnet.',
        tooltip:
          '„Partner“ oder „verbunden“ heißt: Ein anderes Unternehmen hält mindestens 25 % Ihrer Anteile – oder Sie halten mindestens 25 % an einem anderen. Wenn das nicht der Fall ist, wählen Sie „eigenständig“.',
        optionen: [
          { wert: 'eigenstaendig', label: 'Nein, wir sind eigenständig' },
          { wert: 'partner', label: 'Ja, Partnerunternehmen vorhanden' },
          { wert: 'verbunden', label: 'Ja, verbundene Unternehmen vorhanden' },
        ],
      },
      {
        name: 'vorsteuerabzug',
        typ: 'auswahl',
        label: 'Vorsteuerabzugsberechtigt?',
        pflicht: true,
        standard: 'ja',
        hilfe: 'Förderfähig sind Netto-Kosten bei Vorsteuerabzug, sonst Brutto-Kosten. Für fast alle Unternehmen ist „Ja“ richtig.',
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
        label: 'Ihr Unternehmen ist …',
        pflicht: true,
        tooltip:
          'GmbH, AG, UG & Co. sind „juristische Personen“. Einzelunternehmer und Freiberufler wählen „natürliche Person“.',
        optionen: [
          { wert: 'juristisch', label: 'eine Firma (z. B. GmbH, AG, UG)' },
          { wert: 'natuerlich', label: 'ein Einzelunternehmen (Privatperson)' },
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
        typ: 'steuer_id',
        label: 'Steuer-ID (11-stellig)',
        sichtbarWenn: { feld: 'personenart', ist: 'natuerlich' },
        pflicht: true,
        hilfe: 'Pflichtangabe des BAFA – wird verschlüsselt übertragen und nicht an Dritte weitergegeben.',
        tooltip:
          'Ihre persönliche steuerliche Identifikationsnummer (11 Ziffern). Sie steht auf jedem Einkommensteuerbescheid und auf der Lohnabrechnung.',
      },
      {
        name: 'steuernummer',
        typ: 'steuernummer',
        label: 'Steuernummer',
        sichtbarWenn: { feld: 'personenart', ist: 'juristisch' },
        pflicht: true,
        hilfe: 'Die Steuernummer des Unternehmens (nicht die USt-IdNr.), Format z. B. 123/456/78901.',
        tooltip:
          'Die Steuernummer hat Ihr Unternehmen vom Finanzamt erhalten – sie steht auf jedem Schreiben des Finanzamts. Nicht verwechseln mit der USt-IdNr. (beginnt mit „DE“).',
      },
      {
        name: 'ust_id',
        typ: 'ust_id',
        label: 'USt-IdNr. (falls vorhanden)',
        sichtbarWenn: { feld: 'personenart', ist: 'juristisch' },
        hilfe: 'Beginnt mit „DE“, gefolgt von 9 Ziffern. Steht auf Rechnungen und im Impressum.',
        tooltip:
          'Die Umsatzsteuer-Identifikationsnummer braucht das BAFA für die Antragsprüfung. Keine vorhanden? Dann lassen Sie das Feld einfach leer – die Steuernummer genügt.',
      },
    ],
  },
  {
    id: 'ansprechpartner',
    titel: 'Ansprechpartner in Ihrem Unternehmen',
    kurz: 'Kontakt',
    beschreibung: 'Wer ist fachlich für dieses Vorhaben zuständig?',
    erklaerung:
      'Für Rückfragen des Förderamts (BAFA) brauchen wir eine feste Kontaktperson in Ihrem Unternehmen – idealerweise jemand, der das Projekt fachlich kennt.',
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
      'Der Staat muss sicherstellen, dass ein Unternehmen nicht zu viele kleine Förderungen sammelt. Deshalb listen Sie hier alle staatlichen „De-minimis“-Zuschüsse der letzten drei Jahre auf. Sie erkennen diese an der „De-minimis-Bescheinigung“ in den Förderunterlagen. Die meisten Unternehmen haben keine – dann sind Sie hier in 30 Sekunden fertig.',
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
        label: 'Wem gehört Ihr Unternehmen?',
        pflicht: true,
        standard: 'privat',
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
        label: 'Ort der Umsetzung: PLZ',
        hilfe: 'Wo wird die Maßnahme installiert? Nur ausfüllen, wenn das von Ihrer Firmenadresse abweicht.',
        tooltip:
          'Das BAFA braucht den genauen Installationsort der Mess- und Steuerungstechnik. In den meisten Fällen ist das Ihr Firmensitz – dann einfach leer lassen.',
      },
      { name: 'standort_ort', typ: 'text', label: 'Ort der Umsetzung: Ort' },
      { name: 'standort_strasse', typ: 'text', label: 'Ort der Umsetzung: Straße + Hausnr.' },
      { name: 'kontoinhaber', typ: 'text', label: 'Kontoinhaber (wie im Konto geführt – meist die Firma)', pflicht: true },
      {
        name: 'iban',
        typ: 'iban',
        label: 'IBAN',
        pflicht: true,
        hilfe: 'Wird nur für die Auszahlung Ihres Zuschusses benötigt – keine Abbuchung, keine Weitergabe.',
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
      'Letzter Schritt: Sie entscheiden, ob unser Fördermittel-Team (WissensReich Academy, in Kooperation mit der Eskalator AG) den Antrag komplett für Sie übernimmt (empfohlen – inklusive aller Rückfragen der Behörde) oder ob Sie ihn selbst einreichen möchten.',
    komponente: 'vollmacht',
  },
]

export const SCHRITT_IDS = SCHRITTE.map((s) => s.id)
export type SchrittId = (typeof SCHRITT_IDS)[number]

export function schrittNach(id: string): SchrittDef | undefined {
  return SCHRITTE.find((s) => s.id === id)
}
