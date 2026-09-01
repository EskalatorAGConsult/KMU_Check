/**
 * TypeScript-Typen der Datenbank (Spiegel von supabase/schemas/).
 * Werden bei Schema-Aenderungen manuell synchron gehalten, bis die
 * Typgenerierung via Supabase-CLI eingerichtet ist (geplant, siehe Plan M0).
 */

export type AngebotStatus =
  | 'angelegt'
  | 'eingeladen'
  | 'in_bearbeitung'
  | 'eingereicht'
  | 'abgeschlossen'
  | 'widerrufen'

export type Technologie = 'software' | 'messtechnik' | 'steuerung'
export type SoftwareVariante = 'mabe_cloud' | 'andere' | 'offen'
export type Unternehmensart = 'eigenstaendig' | 'partner' | 'verbunden'
export type Personenart = 'natuerlich' | 'juristisch'
export type Gruppenzugehoerigkeit = 'privat' | 'kommunal' | 'land' | 'freiberuflich' | 'contractor'
export type BeteiligungRichtung = 'abwaerts' | 'aufwaerts'
export type BeihilfeForm = 'zuschuss' | 'darlehen' | 'buergschaft'
export type BeihilfeKategorie = 'allgemein' | 'agrar' | 'fisch'
export type BeihilfeStatus = 'gewaehrt' | 'beantragt'
export type Beantragungsweg = 'selbst' | 'eskalator'

export interface Angebot {
  id: string
  angelegt_von: string
  status: AngebotStatus
  kunde_firma: string
  kunde_ansprechpartner: string | null
  kunde_email: string
  angebot_nr: string
  angebot_datum: string
  technologien: Technologie[]
  software_variante: SoftwareVariante | null
  invest_software: number | null
  invest_messtechnik: number | null
  invest_steuerung: number | null
  sensoren_gesamt: number | null
  sensoren_prozessbezug: number | null
  projektende: string | null
  notiz: string | null
  angebot_pdf_path: string | null
  extraktion: Record<string, unknown> | null
  extrahiert_am: string | null
  extraktion_bestaetigt: boolean
  created_at: string
  updated_at: string
}

export interface JourneyToken {
  id: string
  angebot_id: string
  token_hash: string
  expires_at: string
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
}

export interface JourneyFortschritt {
  angebot_id: string
  aktueller_schritt: string
  schritte: Record<string, Record<string, unknown>>
  created_at: string
  updated_at: string
}

export interface BeteiligungInsert {
  angebot_id: string
  name: string
  richtung: BeteiligungRichtung
  anteil_pct: number
  jae: number | null
  umsatz: number | null
  bilanzsumme: number | null
  quelle: 'manuell' | 'openregister'
  /** Kettentiefe (1 = direkt); nur bei OpenRegister-Vorbefuellung. */
  stufe?: number | null
  /** Letzte Kante der Beteiligungskette (OpenRegister). */
  pfad?: string | null
  /** Bezugsunternehmen der Kante; NULL/leer = Antragsteller (Stufe 1). */
  bezug?: string | null
}

export type AuditActor = `admin:${string}` | `kunde:${string}` | 'system'

// ---------- Zeilen-Typen fuer Vollauszuege (Admin/Kunde/Dossier) ----------
// Spiegel der Tabellen aus supabase/schemas/03_tables.sql + Migrationen.

export interface StammdatenRow {
  angebot_id: string
  unternehmensname: string
  land: string
  plz: string
  ort: string
  strasse: string
  email: string
  wz_code: string
  unternehmensart: Unternehmensart
  vorsteuerabzug: boolean
  personenart: Personenart
  geburtsdatum: string | null
  steuer_id: string | null
  steuernummer: string | null
  ust_id: string | null
  ap_rolle: string | null
  ap_anrede: string | null
  ap_vorname: string | null
  ap_nachname: string | null
  ap_email: string | null
  gruppenzugehoerigkeit: Gruppenzugehoerigkeit
  wirtschaftlich_taetig: boolean
  kontoinhaber: string | null
  iban: string | null
  standort_plz: string | null
  standort_ort: string | null
  standort_strasse: string | null
  vorhaben_nicht_begonnen: boolean | null
  dsgvo_einwilligung_at: string | null
  register_company_id: string | null
  register_snapshot: Record<string, unknown> | null
  register_abgerufen_am: string | null
  created_at: string
  updated_at: string
}

export interface BeteiligungRow {
  id: string
  angebot_id: string
  name: string
  richtung: BeteiligungRichtung
  anteil_pct: number
  jae: number | null
  umsatz: number | null
  bilanzsumme: number | null
  quelle: 'manuell' | 'openregister'
  stufe: number | null
  pfad: string | null
  bezug: string | null
  created_at: string
}

export interface KmuBewertungRow {
  id: string
  angebot_id: string
  geschaeftsjahr: number
  abgeschlossen: boolean
  jae: number | null
  umsatz: number | null
  bilanzsumme: number | null
  kategorie: 'kleinst' | 'klein' | 'mittel' | 'gross' | null
  foerderquote_pct: number | null
  /** Vollstaendiges KmuResult aus src/lib/kmu.ts (Snapshot). */
  berechnung: Record<string, unknown> | null
  created_at: string
}

export interface DeminimisBeihilfeRow {
  id: string
  angebot_id: string
  beihilfegeber: string
  aktenzeichen: string | null
  bewilligt_am: string
  betrag: number
  form: BeihilfeForm
  kategorie: BeihilfeKategorie
  status: BeihilfeStatus
  created_at: string
}

export interface DeminimisErklaerungRow {
  angebot_id: string
  fusion_3j: boolean
  uebernahme_3j: boolean
  aufspaltung_3j: boolean
  summe_eur: number
  bestaetigt_at: string
}

export interface VollmachtRow {
  angebot_id: string
  beantragungsweg: Beantragungsweg
  signatur_modus: 'canvas' | 'upload' | null
  signatur_bild_path: string | null
  pdf_path: string | null
  unterzeichnet_at: string | null
  unterzeichnet_von: string | null
  unterschrift_ip: string | null
  unterschrift_ua: string | null
  created_at: string
}

export interface DokumentRow {
  id: string
  angebot_id: string
  typ: string
  storage_path: string
  created_at: string
}

export interface UebergabeRow {
  id: string
  angebot_id: string
  http_status: number | null
  erfolg: boolean
  versucht_at: string
}

export interface AuditEventRow {
  id: number
  angebot_id: string | null
  actor: string
  aktion: string
  details: Record<string, unknown> | null
  created_at: string
}

/** Zugriffsprotokoll eines Kunden auf den Journey-Link (Migration 20). */
export interface KundenZugriffRow {
  id: string
  angebot_id: string
  token_id: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

/** Feldgenaue Admin-Aenderungshistorie (Migration 19). */
export interface VorgangRevisionRow {
  id: string
  angebot_id: string
  bearbeitet_von: string
  bereich: 'angebot' | 'stammdaten'
  /** { feld: { alt, neu } } – nur geaenderte Felder. */
  aenderungen: Record<string, { alt: unknown; neu: unknown }>
  created_at: string
}

/** Interne Berater-Notiz mit optionaler Wiedervorlage (Migration 21). */
export interface VorgangNotizRow {
  id: string
  angebot_id: string
  /** Better-Auth-User-ID des Verfassers (Admin). */
  autor: string
  text: string
  /** ISO-Datum JJJJ-MM-TT oder null. */
  wiedervorlage_am: string | null
  created_at: string
}
