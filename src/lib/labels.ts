import type {
  AngebotStatus,
  Beantragungsweg,
  BeihilfeForm,
  BeihilfeKategorie,
  BeihilfeStatus,
  BeteiligungRichtung,
  Gruppenzugehoerigkeit,
  Personenart,
  SoftwareVariante,
  Technologie,
  Unternehmensart,
} from '@/lib/db/types'

/**
 * Zentrale, deutsche Beschriftungen aller Enum-Werte (BAFA-Wording).
 * Single Source of Truth fuer Admin-UI, Dossier-Texte und E-Mails –
 * bei neuen Enum-Werten hier ergaenzen (TypeScript zwingt via Record).
 */

export const TECHNOLOGIE_LABELS: Record<Technologie, string> = {
  software: 'Energiemanagementsoftware',
  messtechnik: 'Mess- und Sensortechnik',
  steuerung: 'Steuerungs- und Regelungstechnik',
}

export const SOFTWARE_VARIANTE_LABELS: Record<SoftwareVariante, string> = {
  mabe_cloud: 'MABE smart control (Cloud)',
  andere: 'Andere Software',
  offen: 'Noch offen',
}

export const UNTERNEHMENSART_LABELS: Record<Unternehmensart, string> = {
  eigenstaendig: 'Eigenständiges Unternehmen',
  partner: 'Partnerunternehmen',
  verbunden: 'Verbundenes Unternehmen',
}

export const PERSONENART_LABELS: Record<Personenart, string> = {
  juristisch: 'Juristische Person',
  natuerlich: 'Natürliche Person',
}

export const GRUPPENZUGEHOERIGKEIT_LABELS: Record<Gruppenzugehoerigkeit, string> = {
  privat: 'Privates Unternehmen',
  kommunal: 'Kommunales Unternehmen',
  land: 'Landesunternehmen',
  freiberuflich: 'Freiberuflich Tätige',
  contractor: 'Contractor',
}

export const BETEILIGUNG_RICHTUNG_LABELS: Record<BeteiligungRichtung, string> = {
  abwaerts: 'Unsere Beteiligung an diesem Unternehmen',
  aufwaerts: 'Dieses Unternehmen ist an uns beteiligt',
}

export const BEIHILFE_FORM_LABELS: Record<BeihilfeForm, string> = {
  zuschuss: 'Zuschuss',
  darlehen: 'Darlehen',
  buergschaft: 'Bürgschaft',
}

export const BEIHILFE_KATEGORIE_LABELS: Record<BeihilfeKategorie, string> = {
  allgemein: 'Allgemein (De-minimis)',
  agrar: 'Landwirtschaft',
  fisch: 'Fischerei/Aquakultur',
}

export const BEIHILFE_STATUS_LABELS: Record<BeihilfeStatus, string> = {
  gewaehrt: 'Gewährt',
  beantragt: 'Beantragt',
}

export const BEANTRAGUNGSWEG_LABELS: Record<Beantragungsweg, string> = {
  selbst: 'Beantragung durch das Unternehmen selbst',
  eskalator: 'Beantragung durch den Fördermittel-Concierge der Eskalator AG',
}

export const ANGEBOT_STATUS_LABELS: Record<AngebotStatus, string> = {
  angelegt: 'Angelegt',
  eingeladen: 'Eingeladen',
  in_bearbeitung: 'In Bearbeitung',
  eingereicht: 'Eingereicht',
  abgeschlossen: 'Abgeschlossen',
  widerrufen: 'Widerrufen',
}

export const DOKUMENT_TYP_LABELS: Record<string, string> = {
  angebot_pdf: 'Angebots-PDF',
  systemkonzept: 'Systemkonzept mit Datenerfassungsplan',
  vollmacht: 'Vollmacht (BAFA-Formular eew_vm_3)',
  dossier: 'Datenübersicht (Dossier)',
  upload: 'Kunden-Upload',
}

/** Kurzlabel fuer die Uebersichtstabellen (Dashboard, Kundenliste). */
export const ANGEBOT_STATUS_KURZ: Record<AngebotStatus, string> = {
  angelegt: 'Angelegt',
  eingeladen: 'Eingeladen',
  in_bearbeitung: 'In Bearb.',
  eingereicht: 'Eingereicht',
  abgeschlossen: 'Abgeschl.',
  widerrufen: 'Widerrufen',
}
