import type { BescheidRow, VerwendungsnachweisRow, VnwBelegRow } from '@/lib/db/types'

/**
 * Fachliche Domäne „Bewilligung & Verwendungsnachweis" (BAFA EEW Modul 3,
 * Migration 25) – rein, framework-frei und damit voll unit-testbar
 * (gleiches Muster wie src/lib/kmu.ts).
 *
 * Recherchierte Fachgrundlagen (BAFA, Stand 2026-11):
 * - Vorhabensbeginn erst nach Erhalt des Zuwendungsbescheids.
 * - Verwendungsnachweis innerhalb der Vorlagefrist laut Bescheid
 *   (BAFA-Merkblatt: regelmäßig 3 Monate nach Ablauf des Bewilligungs-
 *   zeitraums; Versäumnis kann zum Widerruf führen).
 * - Verbindlich ist IMMER der konkrete Bescheid – deshalb existiert kein
 *   geratener Frist-Default: Fehlt die Frist, wird sie als offen markiert.
 */

/** Wie dringend ist die VNW-Vorlagefrist? (Ampel für Kunde & Berater) */
export type FristStatus = 'ungefasst' | 'ok' | 'knapp' | 'ueberfaellig' | 'eingereicht'

/** Tage ab heute bis zur Frist (negativ = überfällig); null ohne Frist. */
export function tageBisFrist(fristAm: string | null | undefined, heute: Date): number | null {
  if (!fristAm) return null
  const frist = new Date(`${fristAm}T00:00:00`)
  if (Number.isNaN(frist.getTime())) return null
  const tag = 24 * 60 * 60 * 1000
  return Math.floor((frist.getTime() - startVonTag(heute).getTime()) / tag)
}

function startVonTag(d: Date): Date {
  const kopie = new Date(d)
  kopie.setHours(0, 0, 0, 0)
  return kopie
}

/** Frist-Ampel: 'knapp' ab KNAPP_TAGE vor der Frist, eingereicht schlägt alles. */
export const FRIST_KNAPP_TAGE = 28

export function fristStatus(
  fristAm: string | null | undefined,
  heute: Date,
  eingereicht: boolean,
): { status: FristStatus; tageRest: number | null } {
  if (eingereicht) return { status: 'eingereicht', tageRest: null }
  const tage = tageBisFrist(fristAm, heute)
  if (tage === null) return { status: 'ungefasst', tageRest: null }
  if (tage < 0) return { status: 'ueberfaellig', tageRest: tage }
  if (tage <= FRIST_KNAPP_TAGE) return { status: 'knapp', tageRest: tage }
  return { status: 'ok', tageRest: tage }
}

/** Plausibilität des Durchführungszeitraums (reine Funktion, DB-CHECK gespiegelt). */
export function zeitraumGueltig(von: string | null, bis: string | null): boolean {
  if (!von || !bis) return true
  return new Date(von).getTime() <= new Date(bis).getTime()
}

// ---------- Fristen-Erinnerungen (Reminder, Migration 26) ----------

/** Konfigurierbare Vorlauf-Zeiten in Tagen (Admin-Einstellungen, Defaults). */
export interface FristErinnerungsEinstellungen {
  zeitraumEndeTage: number
  vnwFristTage: number
}

export const FRIST_ERINNERUNG_STANDARD: FristErinnerungsEinstellungen = {
  zeitraumEndeTage: 14,
  vnwFristTage: 28,
}

/**
 * Eine Frist ist erinnerungs-faellig, sobald die Restzeit die konfigurierte
 * Vorlauf-Zeit erreicht oder unterschreitet, auch bereits ueberfaellig
 * (negative Resttage: der Anlass ist dringender, nicht erledigt). Ohne Frist
 * oder unsinnige Konfiguration (< 1 Tag): nie.
 */
export function fristErinnerungsFaellig(
  fristAm: string | null | undefined,
  tageVorher: number,
  heute: Date,
): boolean {
  if (!fristAm || tageVorher < 1) return false
  const tage = tageBisFrist(fristAm, heute)
  return tage !== null && tage <= tageVorher
}

export type FristErinnerungsArt = 'zeitraum_ende' | 'vnw_frist'

/** Kandidaten-Snapshot aus der DB (bescheid vorhanden, Vorgang nicht widerrufen). */
export interface FristKandidat {
  angebotId: string
  angebotNr: string
  kundeFirma: string
  durchfuehrungBis: string | null
  vnwFrist: string | null
  /** VNW-Snapshot hat Vorrang (Domänen-Regel wirksameFrist). */
  vnwVorlagefrist: string | null
  vnwEingereicht: boolean
}

export interface FristErinnerung {
  angebotId: string
  angebotNr: string
  kundeFirma: string
  art: FristErinnerungsArt
  fristAm: string
  tageRest: number
}

/**
 * Reine Sammel-Logik: ermittelt aus Kandidaten-Snapshots die fälligen
 * Erinnerungen (je Vorgang max. eine je Art).
 * - zeitraum_ende: Ende des Durchführungszeitraums laeuft der Konfiguration nach ab.
 * - vnw_frist: nur solange der Verwendungsnachweis NICHT eingereicht ist;
 *   wirksame Frist = VNW-Snapshot vor Bescheid-Frist (gleiche Regel wie die Ampel).
 */
export function sammleFristErinnerungen(
  kandidaten: FristKandidat[],
  einstellungen: FristErinnerungsEinstellungen,
  heute: Date,
): FristErinnerung[] {
  const aus: FristErinnerung[] = []
  for (const k of kandidaten) {
    if (fristErinnerungsFaellig(k.durchfuehrungBis, einstellungen.zeitraumEndeTage, heute)) {
      aus.push({
        angebotId: k.angebotId,
        angebotNr: k.angebotNr,
        kundeFirma: k.kundeFirma,
        art: 'zeitraum_ende',
        fristAm: k.durchfuehrungBis as string,
        tageRest: tageBisFrist(k.durchfuehrungBis, heute) ?? 0,
      })
    }
    if (!k.vnwEingereicht) {
      const wirksam = k.vnwVorlagefrist ?? k.vnwFrist
      if (fristErinnerungsFaellig(wirksam, einstellungen.vnwFristTage, heute)) {
        aus.push({
          angebotId: k.angebotId,
          angebotNr: k.angebotNr,
          kundeFirma: k.kundeFirma,
          art: 'vnw_frist',
          fristAm: wirksam as string,
          tageRest: tageBisFrist(wirksam, heute) ?? 0,
        })
      }
    }
  }
  return aus
}

/** Zusammenfassender Zustand eines Vorgangs nach der Einreichung. */
export interface NachweisEingabe {
  bescheid: Pick<
    BescheidRow,
    | 'vnw_frist_am'
    | 'durchfuehrung_von'
    | 'durchfuehrung_bis'
    | 'bestaetigt_am'
    | 'foerdersumme_eur'
  > | null
  vnw: Pick<VerwendungsnachweisRow, 'status' | 'vorlagefrist_am'> | null
  belege: Pick<VnwBelegRow, 'betrag_eur'>[]
}

/**
 * Objekt-Domäne (OOP): kapselt alle abgeleiteten Aussagen der neuen
 * Stationen. Unveränderlich nach Konstruktion – jede Methode ist eine
 * reine Ableitung aus dem Snapshot, keine Seiteneffekte.
 */
export class NachweisKontext {
  private readonly bescheid: NachweisEingabe['bescheid']
  private readonly vnw: NachweisEingabe['vnw']
  private readonly belege: NachweisEingabe['belege']
  private readonly heute: Date

  constructor(eingabe: NachweisEingabe, heute = new Date()) {
    this.bescheid = eingabe.bescheid
    this.vnw = eingabe.vnw
    this.belege = eingabe.belege
    this.heute = heute
  }

  /** Bescheid wurde hochgeladen (Daten ggf. noch unbestätigt). */
  get bescheidVorhanden(): boolean {
    return this.bescheid !== null
  }

  /** Bescheid-Daten wurden von einem Menschen geprüft (= Status 'bewilligt'-reif). */
  get bescheidBestaetigt(): boolean {
    return this.bescheid?.bestaetigt_am != null
  }

  /**
   * Aktivierungs-Regel der neuen Stationen: Durchführungszeitraum und
   * Verwendungsnachweis werden mit dem hochgeladenen Bescheid aktiv.
   * (Bewusst am Upload festgemacht, nicht an der Bestätigung – der Kunde
   * soll Fristen schon sehen, während er die OCR-Werte prüft.)
   */
  get stationenAktiv(): boolean {
    return this.bescheidVorhanden
  }

  /** Wirksame VNW-Vorlagefrist: VNW-Snapshot hat Vorrang, sonst Bescheid. */
  get wirksameFrist(): string | null {
    return this.vnw?.vorlagefrist_am ?? this.bescheid?.vnw_frist_am ?? null
  }

  /** Frist-Ampel inkl. Resttagen (nutzt VNW-Status für 'eingereicht'). */
  get frist(): { status: FristStatus; tageRest: number | null } {
    return fristStatus(this.wirksameFrist, this.heute, this.vnw?.status === 'eingereicht')
  }

  /** Bewilligter Zeitraum (Anzeige); null solange nicht erfasst. */
  get durchfuehrungszeitraum(): { von: string; bis: string } | null {
    if (!this.bescheid?.durchfuehrung_von || !this.bescheid?.durchfuehrung_bis) return null
    return { von: this.bescheid.durchfuehrung_von, bis: this.bescheid.durchfuehrung_bis }
  }

  /** Belegsumme (nur erfasste Beträge) für die Soll/Ist-Sicht. */
  get belegSummeEur(): number {
    return this.belege.reduce((s, b) => s + (b.betrag_eur ?? 0), 0)
  }

  /** Voraussetzungen für die Einreichung des Verwendungsnachweises. */
  get darfEinreichen(): boolean {
    return this.stationenAktiv && this.bescheidBestaetigt && this.belege.length > 0
  }

  /** Fehlende Bausteine für die Einreichung (deutsche Labels für UI/Mail). */
  get fehlendeBausteine(): string[] {
    const fehlt: string[] = []
    if (!this.stationenAktiv) fehlt.push('Zuwendungsbescheid hochladen')
    if (this.stationenAktiv && !this.bescheidBestaetigt) fehlt.push('Bescheidangaben bestätigen')
    if (this.stationenAktiv && this.belege.length === 0) fehlt.push('Mindestens einen Beleg hochladen')
    return fehlt
  }
}
