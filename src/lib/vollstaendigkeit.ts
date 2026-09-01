import type { DeminimisErklaerungRow, DokumentRow, KmuBewertungRow, StammdatenRow, VollmachtRow } from '@/lib/db/types'

/**
 * Vollstaendigkeits-Check (Einreichungsreife BAFA EEW Modul 3).
 * Rein, framework-frei, ohne Seiteneffekte – derselbe Vertrag speist die
 * Fallakte (UI), das Fallakte-PDF und kuenftige Ampel-Badges in Listen.
 *
 * Vertrag: Eingabe = die fachlichen Tabellen eines Vorgangs (schon geladen),
 * Ausgabe = begruendete Baustein-Liste; NICHT geprueft wird die inhaltliche
 * Plausibilitaet (das leisten die Journey-Schemas bei der Erfassung).
 */

export type BausteinId =
  | 'stammdaten'
  | 'steuer_bank'
  | 'ansprechpartner'
  | 'kmu'
  | 'deminimis'
  | 'vollmacht'
  | 'systemkonzept'

export interface Baustein {
  id: BausteinId
  label: string
  ok: boolean
  /** Konkrete Begruendung, was fehlt (nur wenn ok === false). */
  hinweis?: string
}

export interface Vollstaendigkeit {
  bausteine: Baustein[]
  /** Labels aller offenen Bausteine (fuer Badges/Zusammenfassungen). */
  offen: string[]
  vollstaendig: boolean
}

export interface VollstaendigkeitsEingabe {
  stammdaten: Pick<
    StammdatenRow,
    | 'unternehmensname'
    | 'plz'
    | 'ort'
    | 'strasse'
    | 'email'
    | 'wz_code'
    | 'personenart'
    | 'steuernummer'
    | 'steuer_id'
    | 'geburtsdatum'
    | 'kontoinhaber'
    | 'iban'
    | 'ap_vorname'
    | 'ap_nachname'
    | 'ap_email'
  > | null
  kmuBewertungen: Pick<KmuBewertungRow, 'geschaeftsjahr' | 'kategorie'>[]
  deminimis: Pick<DeminimisErklaerungRow, 'angebot_id'> | null
  vollmacht: Pick<VollmachtRow, 'beantragungsweg' | 'unterzeichnet_von' | 'pdf_path' | 'signatur_bild_path'> | null
  dokumente: Pick<DokumentRow, 'typ'>[]
}

/** BAFA fragt die Kennzahlen zweier Geschaeftsjahre ab (2025 + 2024). */
const ERWARTETE_KMU_JAHRE = 2

export function pruefeVollstaendigkeit(e: VollstaendigkeitsEingabe): Vollstaendigkeit {
  const bausteine: Baustein[] = []
  const sd = e.stammdaten

  // 1 · Stammdaten des Unternehmens
  if (!sd) {
    bausteine.push({ id: 'stammdaten', label: 'Stammdaten des Unternehmens', ok: false, hinweis: 'Noch nicht eingereicht.' })
  } else {
    const fehlend = [
      ['unternehmensname', sd.unternehmensname, 'Unternehmensname'],
      ['Anschrift', sd.strasse && sd.plz && sd.ort, 'Straße/PLZ/Ort'],
      ['E-Mail', sd.email, 'E-Mail'],
      ['WZ-Code', sd.wz_code, 'WZ-Code'],
    ].filter(([, v]) => !v)
    bausteine.push({
      id: 'stammdaten',
      label: 'Stammdaten des Unternehmens',
      ok: fehlend.length === 0,
      hinweis: fehlend.length > 0 ? `Fehlt: ${fehlend.map((f) => f[2]).join(', ')}.` : undefined,
    })
  }

  // 2 · Steuer & Bank (personenart-abhaengig)
  if (!sd) {
    bausteine.push({ id: 'steuer_bank', label: 'Steuer & Bankverbindung', ok: false, hinweis: 'Noch nicht eingereicht.' })
  } else {
    const fehlend: string[] = []
    if (sd.personenart === 'juristisch') {
      if (!sd.steuernummer) fehlend.push('Steuernummer')
    } else {
      if (!sd.steuer_id) fehlend.push('Steuer-ID')
      if (!sd.geburtsdatum) fehlend.push('Geburtsdatum')
    }
    if (!sd.kontoinhaber) fehlend.push('Kontoinhaber')
    if (!sd.iban) fehlend.push('IBAN')
    bausteine.push({
      id: 'steuer_bank',
      label: 'Steuer & Bankverbindung',
      ok: fehlend.length === 0,
      hinweis: fehlend.length > 0 ? `Fehlt: ${fehlend.join(', ')}.` : undefined,
    })
  }

  // 3 · Ansprechpartner
  if (!sd) {
    bausteine.push({ id: 'ansprechpartner', label: 'Ansprechpartner', ok: false, hinweis: 'Noch nicht eingereicht.' })
  } else {
    const ok = !!(sd.ap_vorname && sd.ap_nachname && sd.ap_email)
    bausteine.push({
      id: 'ansprechpartner',
      label: 'Ansprechpartner',
      ok,
      hinweis: ok ? undefined : 'Name oder E-Mail des Ansprechpartners fehlt.',
    })
  }

  // 4 · KMU-Einstufung (beide BAFA-Geschaeftsjahre)
  const jahre = new Set(e.kmuBewertungen.map((k) => k.geschaeftsjahr))
  const kategorisiert = e.kmuBewertungen.some((k) => k.kategorie)
  bausteine.push({
    id: 'kmu',
    label: 'KMU-Einstufung (2 Geschäftsjahre)',
    ok: jahre.size >= ERWARTETE_KMU_JAHRE && kategorisiert,
    hinweis:
      jahre.size < ERWARTETE_KMU_JAHRE
        ? `Erst ${jahre.size} von ${ERWARTETE_KMU_JAHRE} Geschäftsjahren erfasst.`
        : !kategorisiert
          ? 'Keine Kategorie/Förderquote berechnet.'
          : undefined,
  })

  // 5 · De-minimis-Erklaerung
  bausteine.push({
    id: 'deminimis',
    label: 'De-minimis-Erklärung',
    ok: !!e.deminimis,
    hinweis: e.deminimis ? undefined : 'Noch nicht abgegeben.',
  })

  // 6 · Vollmacht / Beantragungsweg
  if (!e.vollmacht) {
    bausteine.push({ id: 'vollmacht', label: 'Beantragungsweg & Vollmacht', ok: false, hinweis: 'Noch nicht gewählt.' })
  } else if (e.vollmacht.beantragungsweg === 'eskalator') {
    const ok = !!(e.vollmacht.unterzeichnet_von && (e.vollmacht.pdf_path || e.vollmacht.signatur_bild_path))
    bausteine.push({
      id: 'vollmacht',
      label: 'Beantragungsweg & Vollmacht',
      ok,
      hinweis: ok ? undefined : 'Vollmacht gewählt, aber Unterschrift/Nachweis unvollständig.',
    })
  } else {
    bausteine.push({ id: 'vollmacht', label: 'Beantragungsweg & Vollmacht', ok: true })
  }

  // 7 · Systemkonzept (BAFA-Pflichtanlage)
  const hatSystemkonzept = e.dokumente.some((d) => d.typ === 'systemkonzept')
  bausteine.push({
    id: 'systemkonzept',
    label: 'Systemkonzept mit Datenerfassungsplan',
    ok: hatSystemkonzept,
    hinweis: hatSystemkonzept ? undefined : 'Noch kein Systemkonzept hinterlegt.',
  })

  const offen = bausteine.filter((b) => !b.ok).map((b) => b.label)
  return { bausteine, offen, vollstaendig: offen.length === 0 }
}
