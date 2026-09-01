'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/guards'
import { bildeDiff, hatAenderungen } from '@/lib/admin/revision-diff'
import type { KundeActionErgebnis } from '@/lib/admin/kunden-actions'
import { normalisiereSteuerId, pruefeIban, pruefeSteuerId, pruefeSteuernummer, pruefeUstId, pruefeWzCode } from '@/lib/validierung'
import { holeAngebot } from '@/lib/db/repositories/angebote'
import { audit } from '@/lib/db/repositories/journey'
import {
  aktualisiereAngebotFelder,
  aktualisiereStammdatenFelder,
  holeStammdaten,
  legeStammdatenAn,
  speichereRevision,
} from '@/lib/db/repositories/revisionen'
import { fehlendeStammdatenPflichtfelder } from '@/lib/admin/stammdaten-pflicht'
import type {
  Gruppenzugehoerigkeit,
  Personenart,
  SoftwareVariante,
  Technologie,
  Unternehmensart,
} from '@/lib/db/types'

/**
 * Admin-Bearbeitung von Vorgaengen (Migration 19): korrigiert Angebots- oder
 * Stammdaten eines Vorgangs. Jede Aenderung wird feldgenau als Diff in
 * vorgang_revisionen protokolliert (Historie in der Fallakte) und zusaetzlich
 * als audit_event gefuehrt. Eingaben werden serverseitig validiert; die
 * DB-Constraints (CHECKs, Enums) bleiben die letzte Integritaetsstufe.
 */

// ---------- Whitelists (Mass-Assignment-Schutz) ----------

const ANGEBOT_FELDER = [
  'kunde_firma',
  'kunde_ansprechpartner',
  'kunde_email',
  'angebot_nr',
  'angebot_datum',
  'technologien',
  'software_variante',
  'invest_software',
  'invest_messtechnik',
  'invest_steuerung',
  'sensoren_gesamt',
  'sensoren_prozessbezug',
  'projektende',
  'notiz',
] as const

const STAMMDATEN_FELDER = [
  'unternehmensname',
  'land',
  'plz',
  'ort',
  'strasse',
  'email',
  'wz_code',
  'ust_id',
  'steuernummer',
  'steuer_id',
  'geburtsdatum',
  'unternehmensart',
  'personenart',
  'vorsteuerabzug',
  'gruppenzugehoerigkeit',
  'wirtschaftlich_taetig',
  'ap_rolle',
  'ap_anrede',
  'ap_vorname',
  'ap_nachname',
  'ap_email',
  'kontoinhaber',
  'iban',
  'standort_plz',
  'standort_ort',
  'standort_strasse',
] as const

export interface AngebotBearbeitenEingabe {
  kunde_firma?: string
  kunde_ansprechpartner?: string
  kunde_email?: string
  angebot_nr?: string
  angebot_datum?: string
  technologien?: Technologie[]
  software_variante?: SoftwareVariante | ''
  invest_software?: string
  invest_messtechnik?: string
  invest_steuerung?: string
  sensoren_gesamt?: string
  sensoren_prozessbezug?: string
  projektende?: string
  notiz?: string
}

export interface StammdatenBearbeitenEingabe {
  unternehmensname?: string
  land?: string
  plz?: string
  ort?: string
  strasse?: string
  email?: string
  wz_code?: string
  ust_id?: string
  steuernummer?: string
  steuer_id?: string
  geburtsdatum?: string
  unternehmensart?: Unternehmensart
  personenart?: Personenart
  vorsteuerabzug?: boolean
  gruppenzugehoerigkeit?: Gruppenzugehoerigkeit
  wirtschaftlich_taetig?: boolean
  ap_rolle?: string
  ap_anrede?: string
  ap_vorname?: string
  ap_nachname?: string
  ap_email?: string
  kontoinhaber?: string
  iban?: string
  standort_plz?: string
  standort_ort?: string
  standort_strasse?: string
}

// ---------- Validierungshilfen ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PLZ_RE = /^\d{5}$/
const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/

function zahlOderNull(roh: string | undefined, feld: string): number | null | { fehler: string } {
  if (roh === undefined || roh.trim() === '') return null
  const n = Number(roh.trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return { fehler: `„${feld}“ muss eine Zahl ≥ 0 sein.` }
  return Math.round(n * 100) / 100
}

function datumOderNull(roh: string | undefined): string | null {
  if (!roh || !DATUM_RE.test(roh.trim())) return null
  return roh.trim()
}

// ---------- Actions ----------

/** Bearbeitet die Angebotsdaten eines Vorgangs mit Revisionsprotokoll. */
export async function bearbeiteAngebot(angebotId: string, eingabe: AngebotBearbeitenEingabe): Promise<KundeActionErgebnis> {
  const session = await requireAdmin()
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }

  // Validierung
  if (eingabe.kunde_firma !== undefined && eingabe.kunde_firma.trim().length < 2) {
    return { ok: false, fehler: 'Kundenfirma muss mindestens 2 Zeichen haben.' }
  }
  if (eingabe.kunde_email !== undefined && !EMAIL_RE.test(eingabe.kunde_email.trim())) {
    return { ok: false, fehler: 'Kunden-E-Mail ist ungültig.' }
  }
  if (eingabe.angebot_datum !== undefined && !datumOderNull(eingabe.angebot_datum)) {
    return { ok: false, fehler: 'Angebotsdatum muss im Format JJJJ-MM-TT vorliegen.' }
  }
  if (eingabe.technologien !== undefined && eingabe.technologien.length === 0) {
    return { ok: false, fehler: 'Mindestens eine Technologie muss ausgewählt sein.' }
  }

  const invest: Record<string, number | null> = {}
  for (const feld of ['invest_software', 'invest_messtechnik', 'invest_steuerung'] as const) {
    const wert = zahlOderNull(eingabe[feld], feld)
    if (wert !== null && typeof wert === 'object') return { ok: false, fehler: wert.fehler }
    invest[feld] = wert as number | null
  }
  const sensoren: Record<string, number | null> = {}
  for (const feld of ['sensoren_gesamt', 'sensoren_prozessbezug'] as const) {
    const wert = zahlOderNull(eingabe[feld], feld)
    if (wert !== null && typeof wert === 'object') return { ok: false, fehler: wert.fehler }
    sensoren[feld] = wert === null ? null : Math.round(wert as number)
  }
  if (
    sensoren.sensoren_gesamt !== null &&
    sensoren.sensoren_prozessbezug !== null &&
    (sensoren.sensoren_prozessbezug as number) > (sensoren.sensoren_gesamt as number)
  ) {
    return { ok: false, fehler: 'Sensoren mit Prozessbezug können nicht mehr sein als Sensoren gesamt.' }
  }

  const patch: Record<string, unknown> = {
    kunde_firma: eingabe.kunde_firma?.trim(),
    kunde_ansprechpartner: eingabe.kunde_ansprechpartner?.trim() || null,
    kunde_email: eingabe.kunde_email?.trim(),
    angebot_nr: eingabe.angebot_nr?.trim(),
    angebot_datum: datumOderNull(eingabe.angebot_datum) ?? eingabe.angebot_datum,
    technologien: eingabe.technologien,
    software_variante: eingabe.software_variante || null,
    ...invest,
    ...sensoren,
    projektende: datumOderNull(eingabe.projektende),
    notiz: eingabe.notiz?.trim() || null,
  }

  const diff = bildeDiff(angebot as unknown as Record<string, unknown>, patch, ANGEBOT_FELDER)
  if (!hatAenderungen(diff)) return { ok: true, hinweis: 'Keine Änderungen – alles bereits aktuell.' }

  try {
    const update: Record<string, unknown> = {}
    for (const feld of Object.keys(diff)) update[feld] = patch[feld]
    await aktualisiereAngebotFelder(angebotId, update)
    await speichereRevision(angebotId, session.user.id, 'angebot', diff)
    await audit(angebotId, `admin:${session.user.id}`, 'angebot_bearbeitet', {
      felder: Object.keys(diff),
    })
    revalidatePath('/admin/kunden')
    revalidatePath('/admin')
    return { ok: true, hinweis: `${Object.keys(diff).length} Feld(er) aktualisiert und in der Historie protokolliert.` }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.' }
  }
}

/** Bearbeitet die Stammdaten eines Vorgangs mit Revisionsprotokoll. */
export async function bearbeiteStammdaten(
  angebotId: string,
  eingabe: StammdatenBearbeitenEingabe,
): Promise<KundeActionErgebnis> {
  const session = await requireAdmin()
  const stammdaten = await holeStammdaten(angebotId)
  const istNeuanlage = !stammdaten

  // Erstanlage durch den Fördermittelberater: Pflichtfelder (NOT-NULL) muessen
  // vollstaendig sein, sonst wuerde der Insert an den DB-Constraints scheitern.
  if (istNeuanlage) {
    const fehlend = fehlendeStammdatenPflichtfelder(eingabe as Record<string, unknown>)
    if (fehlend.length > 0) {
      return { ok: false, fehler: `Zum Anlegen fehlen Pflichtfelder: ${fehlend.join(', ')}.` }
    }
  }

  // Land ist fest „Deutschland" (BAFA = Bundesprogramm)
  if (eingabe.land !== undefined && eingabe.land.trim() !== 'Deutschland') {
    return { ok: false, fehler: 'Als Land ist nur „Deutschland“ zulässig (BAFA-Bundesprogramm).' }
  }

  // Enum-Whitelists (Schutz vor manipulierten Formularwerten)
  if (eingabe.unternehmensart !== undefined && !['eigenstaendig', 'partner', 'verbunden'].includes(eingabe.unternehmensart)) {
    return { ok: false, fehler: 'Unternehmensart ist ungültig.' }
  }
  if (eingabe.personenart !== undefined && !['juristisch', 'natuerlich'].includes(eingabe.personenart)) {
    return { ok: false, fehler: 'Personenart ist ungültig.' }
  }
  if (
    eingabe.gruppenzugehoerigkeit !== undefined &&
    !['privat', 'kommunal', 'land', 'freiberuflich', 'contractor'].includes(eingabe.gruppenzugehoerigkeit)
  ) {
    return { ok: false, fehler: 'Gruppenzugehörigkeit ist ungültig.' }
  }

  // Validierung (dieselben Pruefverfahren wie in der Kunden-Journey,
  // src/lib/validierung.ts – inkl. IBAN-Pruefziffer nach ISO 13616)
  if (eingabe.plz !== undefined && !PLZ_RE.test(eingabe.plz.trim())) {
    return { ok: false, fehler: 'PLZ muss 5-stellig sein.' }
  }
  if (eingabe.standort_plz !== undefined && eingabe.standort_plz.trim() !== '' && !PLZ_RE.test(eingabe.standort_plz.trim())) {
    return { ok: false, fehler: 'Standort-PLZ muss 5-stellig sein.' }
  }
  if (eingabe.email !== undefined && !EMAIL_RE.test(eingabe.email.trim())) {
    return { ok: false, fehler: 'Unternehmens-E-Mail ist ungültig.' }
  }
  if (eingabe.ap_email !== undefined && eingabe.ap_email.trim() !== '' && !EMAIL_RE.test(eingabe.ap_email.trim())) {
    return { ok: false, fehler: 'Ansprechpartner-E-Mail ist ungültig.' }
  }
  if (eingabe.iban !== undefined && eingabe.iban.trim() !== '') {
    const p = pruefeIban(eingabe.iban)
    if (!p.ok) return { ok: false, fehler: `IBAN: ${p.fehler}` }
  }
  if (eingabe.steuer_id !== undefined && eingabe.steuer_id.trim() !== '') {
    const p = pruefeSteuerId(eingabe.steuer_id)
    if (!p.ok) return { ok: false, fehler: `Steuer-ID: ${p.fehler}` }
  }
  if (eingabe.ust_id !== undefined && eingabe.ust_id.trim() !== '') {
    const p = pruefeUstId(eingabe.ust_id)
    if (!p.ok) return { ok: false, fehler: `USt-IdNr.: ${p.fehler}` }
  }
  if (eingabe.wz_code !== undefined && eingabe.wz_code.trim() !== '') {
    const p = pruefeWzCode(eingabe.wz_code)
    if (!p.ok) return { ok: false, fehler: `WZ-Code: ${p.fehler}` }
  }
  if (eingabe.steuernummer !== undefined && eingabe.steuernummer.trim() !== '') {
    const p = pruefeSteuernummer(eingabe.steuernummer)
    if (!p.ok) return { ok: false, fehler: `Steuernummer: ${p.fehler}` }
  }
  if (eingabe.geburtsdatum !== undefined && eingabe.geburtsdatum.trim() !== '' && !datumOderNull(eingabe.geburtsdatum)) {
    return { ok: false, fehler: 'Geburtsdatum muss im Format JJJJ-MM-TT vorliegen.' }
  }

  const text = (v: string | undefined) => v?.trim() || null
  const patch: Record<string, unknown> = {
    unternehmensname: eingabe.unternehmensname?.trim(),
    land: eingabe.land?.trim(),
    plz: eingabe.plz?.trim(),
    ort: eingabe.ort?.trim(),
    strasse: eingabe.strasse?.trim(),
    email: eingabe.email?.trim(),
    wz_code: eingabe.wz_code?.trim(),
    ust_id: text(eingabe.ust_id)?.replace(/\s+/g, '').toUpperCase() ?? null,
    steuernummer: text(eingabe.steuernummer),
    // Speicherformat der Steuer-ID ist die reine Ziffernfolge (DB-CHECK ^\d{11}$)
    steuer_id: eingabe.steuer_id?.trim() ? normalisiereSteuerId(eingabe.steuer_id) : null,
    geburtsdatum: datumOderNull(eingabe.geburtsdatum),
    unternehmensart: eingabe.unternehmensart,
    personenart: eingabe.personenart,
    vorsteuerabzug: eingabe.vorsteuerabzug,
    gruppenzugehoerigkeit: eingabe.gruppenzugehoerigkeit,
    wirtschaftlich_taetig: eingabe.wirtschaftlich_taetig,
    ap_rolle: text(eingabe.ap_rolle),
    ap_anrede: text(eingabe.ap_anrede),
    ap_vorname: text(eingabe.ap_vorname),
    ap_nachname: text(eingabe.ap_nachname),
    ap_email: text(eingabe.ap_email),
    kontoinhaber: text(eingabe.kontoinhaber),
    iban: text(eingabe.iban)?.replace(/\s+/g, '').toUpperCase() ?? null,
    standort_plz: text(eingabe.standort_plz),
    standort_ort: text(eingabe.standort_ort),
    standort_strasse: text(eingabe.standort_strasse),
  }

  // Diff-Basis: bei der Erstanlage die leere Menge (jedes Feld gilt als neu gesetzt)
  const diff = bildeDiff((stammdaten ?? {}) as Record<string, unknown>, patch, STAMMDATEN_FELDER)
  if (!hatAenderungen(diff)) return { ok: true, hinweis: 'Keine Änderungen – alles bereits aktuell.' }

  try {
    const update: Record<string, unknown> = {}
    for (const feld of Object.keys(diff)) update[feld] = patch[feld]
    if (istNeuanlage) {
      await legeStammdatenAn(angebotId, update)
    } else {
      await aktualisiereStammdatenFelder(angebotId, update)
    }
    await speichereRevision(angebotId, session.user.id, 'stammdaten', diff)
    await audit(angebotId, `admin:${session.user.id}`, istNeuanlage ? 'stammdaten_angelegt' : 'stammdaten_bearbeitet', {
      felder: Object.keys(diff),
    })
    revalidatePath('/admin/kunden')
    revalidatePath('/admin')
    return {
      ok: true,
      hinweis: istNeuanlage
        ? `Stammdaten im Namen des Kunden angelegt (${Object.keys(diff).length} Felder) und in der Historie protokolliert.`
        : `${Object.keys(diff).length} Feld(er) aktualisiert und in der Historie protokolliert.`,
    }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.' }
  }
}
