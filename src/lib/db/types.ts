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
}

export type AuditActor = `admin:${string}` | `kunde:${string}` | 'system'
