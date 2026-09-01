/**
 * Journey-Engine: Die Klickstrecke der Kunden-Journey ist KONFIGURATION,
 * nicht Code. Schritte hinzufuegen/umstellen/entfernen = Eintrag in
 * `schritte.ts` aendern. Generische Schritte bestehen nur aus Felddefinitionen;
 * fachlich komplexe Schritte (KMU, De-minimis, Vollmacht) registrieren eine
 * eigene Komponente ueber `komponente`.
 */

export type FeldTyp =
  | 'text'
  | 'email'
  | 'zahl'
  | 'datum'
  | 'auswahl'
  | 'checkbox'
  | 'plz'
  | 'iban'
  | 'steuer_id'
  | 'ust_id'
  | 'wz_code'
  | 'steuernummer'

export interface FeldOption {
  wert: string
  label: string
}

export interface FeldDef {
  /** Schluessel im Schritt-Payload (und Ziel-Spaltenname, wo 1:1). */
  name: string
  typ: FeldTyp
  label: string
  /** „Warum fragen wir das?"-Erklaerung unter dem Feld. */
  hilfe?: string
  /** Kurze Laien-Erklaerung hinter einem ⓘ-Symbol am Label (aufklappbar). */
  tooltip?: string
  pflicht?: boolean
  optionen?: FeldOption[]
  placeholder?: string
  /** Vorbefuellter Standardwert (Smart Default) – wird beim Betreten des Schritts gesetzt, editierbar. */
  standard?: string
  /** Visuelle Gruppen-Ueberschrift (Chunking): beginnt eine neue Feldgruppe. */
  gruppe?: string
  /** Bedingte Sichtbarkeit: Feld nur zeigen/validieren, wenn <feld> === <ist>. */
  sichtbarWenn?: { feld: string; ist: string }
}

export type SchrittKomponente = 'generisch' | 'uebersicht' | 'kmu' | 'deminimis' | 'vollmacht'

export interface SchrittDef {
  id: string
  titel: string
  /** Kurzlabel fuer die Fortschrittsanzeige (Standard: titel). */
  kurz?: string
  beschreibung?: string
  /** Laienverstaendliche Einordnung, warum dieser Schritt wichtig ist (Info-Box). */
  erklaerung?: string
  komponente: SchrittKomponente
  felder?: FeldDef[]
  /** Handelsregister-Suchfeld ueber dem Schritt anzeigen (Stammdaten-Prefill). */
  registerSuche?: boolean
}
