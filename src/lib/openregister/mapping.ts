import type { OrDetails, OrHolding, OrIndikator, OrOwner, OrSuchTreffer } from './client'

/**
 * Mapping OpenRegister -> Journey-Datenmodell. Reine Funktionen ohne
 * Framework-/Netzwerk-Abhaengigkeit (wie src/lib/kmu.ts) – voll testbar.
 *
 * EU-KMU-Verbundlogik (2003/361/EG, Anhang Art. 3) ueber BELIEBIG VIELE STUFEN:
 * - Verbundene Unternehmen (> 50 %): volle Verrechnung (100 %) und TRANSITIV –
 *   wer mit einem verbundenen Unternehmen verbunden ist, ist ebenfalls verbunden.
 * - Partnerunternehmen (25–50 %): anteilige Verrechnung, aber NUR direkt beim
 *   Antragsteller (Stufe 1). Partner von Partnern/Verbundenen zaehlen nicht.
 * - ABER: Unternehmen, die mit einem Partnerunternehmen VERBUNDEN sind (> 50 %),
 *   werden wieder zu 100 % verrechnet (und von dort transitiv weiter).
 * - < 25 %: irrelevant.
 * Die eigentliche Verrechnung der Zahlen liegt in src/lib/kmu.ts – hier wird
 * die Kette klassifiziert und der Verrechnungs-Prozentsatz bestimmt.
 */

export interface RegisterTreffer {
  companyId: string
  name: string
  adresse: string | null
  rechtsform: string | null
  aktiv: boolean
  registerLabel: string | null
}

/** Rohe API-Daten eines Unternehmens (Cache-Einheit in openregister_cache). */
export interface Rohdaten {
  details: OrDetails | null
  owners: OrOwner[] | null
  holdings: OrHolding[] | null
}

export interface VerbundBeteiligung {
  registerId: string
  name: string
  /** Richtung der ERSTEN Kante vom Antragsteller aus (Anzeige). */
  richtung: 'abwaerts' | 'aufwaerts'
  /** Kettentiefe: 1 = direkter Gesellschafter/Beteiligung, 2+ = Folgestufen. */
  stufe: number
  klasse: 'partner' | 'verbunden'
  /** DIREKTE Quote der letzten Kante in der Kette (die Verrechnung ueber die
   *  Kette berechnet src/lib/kmu.ts anhand von `bezug` selbst). */
  anteil_pct: number
  /** Bezugsunternehmen der Kante (Name des Ketten-Vorgaengers; Stufe 1 = Antragsteller). */
  bezug: string
  /** Menschenlesbare letzte Kante, z. B. „Henrich Holding hält 80 % an Walter Henrich GmbH". */
  pfad: string
  jae?: number
  umsatz?: number
  bilanzsumme?: number
  quelle: 'openregister'
}

export interface IgnorierteBeteiligung {
  name: string
  anteil_pct: number
  grund: string
}

export interface VerbundJahr {
  geschaeftsjahr: number
  jae?: number
  umsatz?: number
  bilanzsumme?: number
}

export interface VerbundErgebnis {
  unternehmen: {
    name: string
    strasse: string | null
    plz: string | null
    ort: string | null
    wzCode: string | null
    /** Rechtsform-Rohcode der API (z. B. 'gmbh', 'ek') – fuer Personenart-Prefill. */
    rechtsform: string | null
  }
  /** Kennzahlen des eigenen Unternehmens, neuestes Jahr zuerst (max. 2). */
  jahre: VerbundJahr[]
  beteiligungen: VerbundBeteiligung[]
  /** Gefundene, aber EU-irrelevante Beteiligungen – nur zur Info. */
  ignoriert: IgnorierteBeteiligung[]
  /** Anzahl natuerlicher Personen unter den Gesellschaftern (nicht verrechnungspflichtig). */
  natuerlichePersonen: number
  /** true, wenn mindestens ein Verbund-Unternehmen keine Kennzahlen liefern konnte. */
  kennzahlenUnvollstaendig: boolean
  /** true, wenn die Kette wegen der Sicherheitslimits nicht vollstaendig durchsucht wurde. */
  ketteAbgeschnitten: boolean
}

const RECHTSFORMEN: Record<string, string> = {
  gmbh: 'GmbH',
  ag: 'AG',
  se: 'SE',
  kg: 'KG',
  ohg: 'OHG',
  ek: 'e. K.',
  ug: 'UG (haftungsbeschränkt)',
  gbr: 'GbR',
  kgag: 'KGaA',
}

/** Sicherheitslimits der Kettenverfolgung (Kosten- und Laufzeitbremse). */
export const KETTEN_LIMITS = { maxUnternehmen: 20, maxStufe: 8, maxIgnoriert: 10 } as const

export function rechtsformLabel(form?: string | null): string | null {
  if (!form) return null
  return RECHTSFORMEN[form.toLowerCase()] ?? form.toUpperCase()
}

/**
 * Rechtsform -> Personenart des Antragstellers (BAFA-Formular).
 * Konservativ: nur eindeutige Faelle werden vorbefuellt (e. K. = natuerliche
 * Person, kapital-/handelsrechtliche Gesellschaften = juristisch), sonst null.
 */
export function personenartAusRechtsform(form?: string | null): 'juristisch' | 'natuerlich' | null {
  if (!form) return null
  const f = form.toLowerCase()
  if (f === 'ek') return 'natuerlich'
  if (['gmbh', 'ug', 'ag', 'se', 'kgag', 'kg', 'ohg', 'ev', 'stiftung'].includes(f)) return 'juristisch'
  return null
}

// ---------- Suche: Normalisierung & Merge ----------

/**
 * Rechtsform- und Fuellwoerter, die bei der Registersuche das Fuzzy-Ranking
 * verschlechtern. Hintergrund: Registername ist oft die Langform
 * („… Gesellschaft mit beschränkter Haftung"), Nutzer tippen aber „… GmbH" –
 * das zusaetzliche Token draengt den richtigen Treffer aus der Ergebnisliste
 * (live verifiziert an MABE Daaden, 2026-09).
 */
const RECHTSFORM_TOKENS = new Set([
  'gmbh',
  'mbh',
  'ug',
  'ag',
  'se',
  'kg',
  'ohg',
  'gbr',
  'kgaa',
  'ek',
  'ev',
  'e',
  'k',
  'v',
  'co',
  'haftungsbeschränkt',
  'haftungsbeschraenkt',
])

/**
 * Entfernt Rechtsform-Zusaetze aus einem Suchbegriff (wortgrenzengenau).
 * Faellt auf den Originalbegriff zurueck, wenn nichts Sinnvolles uebrig bleibt
 * (< 3 Zeichen), damit z. B. „CO AG" nicht zur Leersuche wird.
 */
export function normalisiereSuchbegriff(q: string): string {
  const original = q.trim()
  let s = original.toLowerCase().replace(/[.,]/g, ' ')
  s = s.replace(/gesellschaft mit beschr(ä|ae)nkter haftung/g, ' ')
  s = s.replace(/&/g, ' ')
  const ergebnis = s
    .split(/\s+/)
    .filter((w) => w.length > 0 && !RECHTSFORM_TOKENS.has(w))
    .join(' ')
    .trim()
  return ergebnis.length >= 3 ? ergebnis : original
}

/**
 * Mergt Trefferlisten mehrerer Suchstrategien (Autocomplete, Filtersuche,
 * Query-Varianten) in Aufrufreihenfolge und dedupliziert nach company_id.
 * Kappt die Gesamtliste auf `max` Treffer.
 */
export function mergeSuchTreffer(listen: OrSuchTreffer[][], max = 20): OrSuchTreffer[] {
  const gesehen = new Set<string>()
  const ausgabe: OrSuchTreffer[] = []
  for (const liste of listen) {
    for (const t of liste) {
      if (!t?.company_id || gesehen.has(t.company_id)) continue
      gesehen.add(t.company_id)
      ausgabe.push(t)
      if (ausgabe.length >= max) return ausgabe
    }
  }
  return ausgabe
}

/** Cent -> Euro (kaufmännisch gerundet). null/undefined bleibt leer. */
function centZuEuro(v?: number | null): number | undefined {
  if (v === null || v === undefined) return undefined
  return Math.round(v / 100)
}

/** Autocomplete-Ergebnisse -> Anzeige-Treffer. */
export function mapTreffer(results: OrSuchTreffer[]): RegisterTreffer[] {
  return results.map((r) => ({
    companyId: r.company_id,
    name: r.name,
    adresse: r.address?.formatted_value ?? null,
    rechtsform: rechtsformLabel(r.legal_form),
    aktiv: r.active,
    registerLabel:
      r.register_type && r.register_number
        ? `${r.register_type} ${r.register_number}${r.register_court ? ` · ${r.register_court}` : ''}`
        : null,
  }))
}

/**
 * Finanzindikatoren -> Geschaeftsjahre (neueste zuerst, max. `maxJahre`).
 * Umsatz/Bilanzsumme kommen in Cent und werden in Euro umgerechnet.
 */
export function kennzahlenAusIndikatoren(indikatoren: OrIndikator[] | null | undefined, maxJahre = 2): VerbundJahr[] {
  return (indikatoren ?? [])
    .filter((i) => i?.date)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, maxJahre)
    .map((i) => ({
      geschaeftsjahr: Number(i.date.slice(0, 4)),
      jae: i.employees ?? undefined,
      umsatz: centZuEuro(i.revenue),
      bilanzsumme: centZuEuro(i.balance_sheet_total),
    }))
    .filter((j) => j.geschaeftsjahr >= 2000 && j.geschaeftsjahr <= 2100)
}

// ---------- Kettenverfolgung ----------

interface Kante {
  zielId: string
  zielName: string
  pct: number
  /** Richtung relativ zum expandierten Knoten: Gesellschafter = aufwaerts, Beteiligung = abwaerts. */
  richtung: 'abwaerts' | 'aufwaerts'
}

interface KnotenZustand {
  klasse: 'start' | 'partner' | 'verbunden'
  stufe: number
  name: string
  richtung: 'abwaerts' | 'aufwaerts'
  anteilDirekt: number
  /** Name des Ketten-Vorgaengers (Bezugsunternehmen der Kante). */
  bezug: string
  pfad: string
}

/** Alle Beteiligungskanten eines Unternehmens (juristische Personen, aktive Holdings). */
function kantenVon(roh: Rohdaten, knotenName: string, zaehler: { natuerliche: number }): Kante[] {
  const kanten: Kante[] = []
  for (const o of roh.owners ?? []) {
    if (o.type === 'natural_person') {
      zaehler.natuerliche += 1
      continue
    }
    if (o.type !== 'legal_person' || !o.id || o.percentage_share === null || o.percentage_share === undefined) continue
    kanten.push({
      zielId: o.id,
      zielName: o.legal_person?.name ?? o.name,
      pct: o.percentage_share,
      richtung: 'aufwaerts',
    })
  }
  for (const h of roh.holdings ?? []) {
    if (h.end || !h.company_id || h.percentage_share === null || h.percentage_share === undefined) continue
    kanten.push({ zielId: h.company_id, zielName: h.name, pct: h.percentage_share, richtung: 'abwaerts' })
  }
  // Eigenbeteiligungen/Artefakte raus (Kante auf sich selbst)
  return kanten.filter((k) => k.zielName !== knotenName || k.pct < 100)
}

export interface KettenAnalyse {
  ergebnis: Omit<VerbundErgebnis, 'ketteAbgeschnitten'>
  /** Verbund-Firmen, deren Rohdaten zum Vervollstaendigen der Kette noch fehlen. */
  fehlendeIds: string[]
  /** true, wenn das Stufenlimit zugeschlagen hat (Kette nicht vollstaendig). */
  abgeschnitten: boolean
}

/**
 * BFS ueber die Beteiligungskette ab dem Antragsteller. Rein funktional:
 * arbeitet auf dem bereits geladenen `graph` (company_id -> Rohdaten);
 * Knoten ohne Daten landen in `fehlendeIds` (der Treiber laedt sie nach
 * und ruft die Funktion erneut auf). Zyklenfest ueber den Knoten-Zustand
 * („verbunden" schlaegt „partner", kein erneutes Expandieren).
 */
export function analysiereVerbundKette(graph: Record<string, Rohdaten>, startId: string): KettenAnalyse {
  const start = graph[startId]
  const startName = start?.details?.name?.name ?? 'Antragsteller'
  const zustaende = new Map<string, KnotenZustand>([
    [startId, { klasse: 'start', stufe: 0, name: startName, richtung: 'aufwaerts', anteilDirekt: 100, bezug: '', pfad: '' }],
  ])
  const ignoriert: IgnorierteBeteiligung[] = []
  const fehlendeIds = new Set<string>()
  const zaehler = { natuerliche: 0 }
  const queue: string[] = [startId]
  let abgeschnitten = false

  const ignoriere = (name: string, pct: number, grund: string) => {
    if (ignoriert.length < KETTEN_LIMITS.maxIgnoriert) ignoriert.push({ name, anteil_pct: pct, grund })
  }

  while (queue.length > 0) {
    const id = queue.shift() as string
    const zustand = zustaende.get(id) as KnotenZustand
    const roh = graph[id]
    if (!roh) {
      fehlendeIds.add(id)
      continue
    }
    const knotenName = roh.details?.name?.name ?? startName

    for (const kante of kantenVon(roh, knotenName, zaehler)) {
      if (kante.zielId === startId) continue // Rueckkante zum Antragsteller
      const bestehend = zustaende.get(kante.zielId)
      if (bestehend?.klasse === 'verbunden') continue // bereits bestmoeglich klassifiziert

      // EU-Klassifizierung: nur Stufe 1 kennt Partner (25–50 %); danach nur noch
      // Mehrheiten (> 50 %), die als verbunden transitiv weiterlaufen.
      const pct = Math.round(kante.pct * 100) / 100
      let klasse: 'partner' | 'verbunden' | null = null
      if (pct > 50) klasse = 'verbunden'
      else if (pct >= 25 && zustand.klasse === 'start') klasse = 'partner'

      if (!klasse) {
        ignoriere(
          kante.zielName,
          pct,
          pct < 25
            ? 'Unter 25 % – für die KMU-Einstufung nicht relevant.'
            : 'Nur eine mittelbare Beteiligung (25–50 %) in der Folgekette – nicht verrechnungspflichtig.',
        )
        continue
      }

      // Stufenlimit: Kette abbrechen, aber Fundstelle trotzdem als abgeschnitten melden
      const stufe = zustand.stufe + 1
      if (stufe > KETTEN_LIMITS.maxStufe) {
        abgeschnitten = true
        continue
      }

      const pfad =
        kante.richtung === 'aufwaerts'
          ? `${kante.zielName} hält ${pct} % an ${knotenName}`
          : `${knotenName} hält ${pct} % an ${kante.zielName}`

      // Upgrade erlaubt: partner -> verbunden (besserer Pfad gefunden)
      if (bestehend && klasse !== 'verbunden') continue
      zustaende.set(kante.zielId, {
        klasse,
        stufe,
        name: kante.zielName,
        richtung: zustand.klasse === 'start' ? kante.richtung : zustand.richtung,
        anteilDirekt: pct,
        bezug: knotenName,
        pfad,
      })
      queue.push(kante.zielId)
    }
  }

  const beteiligungen: VerbundBeteiligung[] = []
  let kennzahlenUnvollstaendig = false
  for (const [id, z] of zustaende) {
    if (z.klasse === 'start') continue
    const roh = graph[id]
    const kennzahlen = kennzahlenAusIndikatoren(roh?.details?.indicators, 1)[0] ?? {}
    if (!roh || (kennzahlen.jae === undefined && kennzahlen.umsatz === undefined && kennzahlen.bilanzsumme === undefined)) {
      kennzahlenUnvollstaendig = true
    }
    beteiligungen.push({
      registerId: id,
      name: roh?.details?.name?.name ?? z.name,
      richtung: z.richtung,
      stufe: z.stufe,
      klasse: z.klasse,
      anteil_pct: z.anteilDirekt,
      bezug: z.bezug,
      pfad: z.pfad,
      jae: kennzahlen.jae,
      umsatz: kennzahlen.umsatz,
      bilanzsumme: kennzahlen.bilanzsumme,
      quelle: 'openregister',
    })
  }
  // Anzeige-Sortierung: Stufe, dann Verrechnungsanteil absteigend
  beteiligungen.sort((a, b) => a.stufe - b.stufe || b.anteil_pct - a.anteil_pct)

  return {
    ergebnis: {
      unternehmen: {
        name: start?.details?.name?.name ?? '',
        strasse: start?.details?.address?.street ?? null,
        plz: start?.details?.address?.postal_code ?? null,
        ort: start?.details?.address?.city ?? null,
        wzCode: start?.details?.industry_codes?.WZ2025?.[0]?.code ?? null,
        rechtsform: start?.details?.legal_form ?? null,
      },
      jahre: kennzahlenAusIndikatoren(start?.details?.indicators, 2),
      beteiligungen,
      ignoriert,
      natuerlichePersonen: zaehler.natuerliche,
      kennzahlenUnvollstaendig,
    },
    fehlendeIds: [...fehlendeIds],
    abgeschnitten,
  }
}
