import 'server-only'

import { supabaseServer } from '@/lib/db/server'
import type { Angebot } from '@/lib/db/types'

/**
 * Kunden-Repository: alles, was ein angemeldeter Kunde ueber SEINE
 * Vorgaenge sehen darf. Aufrufer muessen vorher requireKunde() bzw. eine
 * gepruefte Session haben; die Zuordnung Kunde<->Vorgang laeuft
 * ausschließlich ueber angebot_zugriffe (plus Token-Pruefung beim Claim).
 */

/**
 * Laedt alle eingereichten Daten eines Vorgangs fuer das Kunden-Dossier (PDF).
 * Autorisierung wie holeVorgangFuerUser: nur eigene Vorgaenge (angebot_zugriffe).
 */
export async function holeVorgangDossier(userId: string, angebotId: string) {
  const db = supabaseServer()

  const { data: zugriff } = await db
    .from('angebot_zugriffe')
    .select('id')
    .eq('user_id', userId)
    .eq('angebot_id', angebotId)
    .maybeSingle()
  if (!zugriff) return null

  const { data: angebot } = await db.from('angebote').select('*').eq('id', angebotId).maybeSingle<Angebot>()
  if (!angebot) return null

  const [s, b, k, d, bh, v] = await Promise.all([
    db.from('stammdaten').select('*').eq('angebot_id', angebotId).maybeSingle(),
    db
      .from('beteiligungen')
      .select('name, richtung, anteil_pct, jae, umsatz, bilanzsumme')
      .eq('angebot_id', angebotId),
    db
      .from('kmu_bewertungen')
      .select('kategorie, foerderquote_pct, geschaeftsjahr, jae, umsatz, bilanzsumme')
      .eq('angebot_id', angebotId)
      .order('geschaeftsjahr', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('deminimis_erklaerungen')
      .select('fusion_3j, uebernahme_3j, aufspaltung_3j, summe_eur, bestaetigt_at')
      .eq('angebot_id', angebotId)
      .maybeSingle(),
    db
      .from('deminimis_beihilfen')
      .select('beihilfegeber, aktenzeichen, bewilligt_am, betrag, form, status')
      .eq('angebot_id', angebotId),
    db
      .from('vollmachten')
      .select('beantragungsweg, unterzeichnet_von, unterzeichnet_at')
      .eq('angebot_id', angebotId)
      .maybeSingle(),
  ])

  if (!s.data) return null // ohne eingereichte Stammdaten kein Dossier

  return {
    angebot,
    stammdaten: s.data as Record<string, unknown>,
    beteiligungen: b.data ?? [],
    kmu: k.data ?? null,
    deminimis: d.data ?? null,
    beihilfen: bh.data ?? [],
    vollmacht: v.data ?? null,
  }
}

/** Ordnet einen Vorgang einem Kundenkonto zu (idempotent). */
export async function verknuepfeZugriff(userId: string, angebotId: string): Promise<void> {
  const { error } = await supabaseServer()
    .from('angebot_zugriffe')
    .upsert({ user_id: userId, angebot_id: angebotId }, { onConflict: 'user_id,angebot_id' })
  if (error) throw new Error(`Vorgang konnte nicht zugeordnet werden: ${error.message}`)
}

export interface VorgangUebersicht {
  angebot: Pick<Angebot, 'id' | 'angebot_nr' | 'angebot_datum' | 'kunde_firma' | 'status'>
  /** Anzahl gespeicherter Schritte (0–6, ohne Uebersicht) oder null ohne Fortschritt. */
  gespeicherteSchritte: number
  eingereichteDaten: boolean
}

const BEARBEITBARE_SCHRITTE = 6 // unternehmen, ansprechpartner, kmu, deminimis, antrag, vollmacht

export async function listeVorgaengeFuerUser(userId: string): Promise<VorgangUebersicht[]> {
  const db = supabaseServer()
  const { data: zugriffe, error } = await db
    .from('angebot_zugriffe')
    .select('angebot_id, angebote(id, angebot_nr, angebot_datum, kunde_firma, status)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Vorgänge konnten nicht geladen werden: ${error.message}`)

  const ids = (zugriffe ?? []).map((z) => z.angebot_id as string)
  const fortschritte = new Map<string, Record<string, unknown>>()
  if (ids.length > 0) {
    const { data: f } = await db.from('journey_fortschritt').select('angebot_id, schritte').in('angebot_id', ids)
    for (const row of f ?? []) fortschritte.set(row.angebot_id, (row.schritte ?? {}) as Record<string, unknown>)
  }

  return (zugriffe ?? []).flatMap((z) => {
    const a = z.angebote as unknown as VorgangUebersicht['angebot'] | null
    if (!a) return []
    const schritte = fortschritte.get(a.id) ?? {}
    const gespeichert = Object.keys(schritte).filter((k) => k !== 'uebersicht').length
    return [
      {
        angebot: a,
        gespeicherteSchritte: Math.min(gespeichert, BEARBEITBARE_SCHRITTE),
        eingereichteDaten: a.status === 'eingereicht' || a.status === 'abgeschlossen',
      },
    ]
  })
}

export interface VorgangDokument {
  typ: string
  storage_path: string
  created_at: string
}

export interface VorgangDetail {
  angebot: Angebot
  fortschrittProzent: number
  stammdaten: Record<string, unknown> | null
  kmu: { kategorie: string; foerderquote_pct: number; geschaeftsjahr: number } | null
  vollmacht: { beantragungsweg: string; unterzeichnet_von: string | null; unterzeichnet_at: string | null } | null
  deminimisSumme: number | null
  dokumente: VorgangDokument[]
}

export async function holeVorgangFuerUser(userId: string, angebotId: string): Promise<VorgangDetail | null> {
  const db = supabaseServer()

  // Autorisierung: gehoert der Vorgang diesem Konto?
  const { data: zugriff } = await db
    .from('angebot_zugriffe')
    .select('id')
    .eq('user_id', userId)
    .eq('angebot_id', angebotId)
    .maybeSingle()
  if (!zugriff) return null

  const { data: angebot } = await db.from('angebote').select('*').eq('id', angebotId).maybeSingle<Angebot>()
  if (!angebot) return null

  const { data: fort } = await db
    .from('journey_fortschritt')
    .select('schritte')
    .eq('angebot_id', angebotId)
    .maybeSingle()
  const gespeichert = Object.keys((fort?.schritte ?? {}) as Record<string, unknown>).filter(
    (k) => k !== 'uebersicht',
  ).length
  const eingereicht = angebot.status === 'eingereicht' || angebot.status === 'abgeschlossen'

  let stammdaten: VorgangDetail['stammdaten'] = null
  let kmu: VorgangDetail['kmu'] = null
  let vollmacht: VorgangDetail['vollmacht'] = null
  let deminimisSumme: number | null = null
  let dokumente: VorgangDokument[] = []

  if (eingereicht) {
    const [s, k, v, d, dok] = await Promise.all([
      db.from('stammdaten').select('*').eq('angebot_id', angebotId).maybeSingle(),
      db
        .from('kmu_bewertungen')
        .select('kategorie, foerderquote_pct, geschaeftsjahr')
        .eq('angebot_id', angebotId)
        .order('geschaeftsjahr', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('vollmachten')
        .select('beantragungsweg, unterzeichnet_von, unterzeichnet_at')
        .eq('angebot_id', angebotId)
        .maybeSingle(),
      db.from('deminimis_erklaerungen').select('summe_eur').eq('angebot_id', angebotId).maybeSingle(),
      db
        .from('dokumente')
        .select('typ, storage_path, created_at')
        .eq('angebot_id', angebotId)
        .order('created_at', { ascending: false }),
    ])
    stammdaten = (s.data as Record<string, unknown> | null) ?? null
    kmu = (k.data as VorgangDetail['kmu']) ?? null
    vollmacht = (v.data as VorgangDetail['vollmacht']) ?? null
    deminimisSumme = (d.data?.summe_eur as number | undefined) ?? null
    dokumente = (dok.data as VorgangDokument[] | null) ?? []
  }

  return {
    angebot,
    fortschrittProzent: eingereicht
      ? 100
      : Math.round((Math.min(gespeichert, BEARBEITBARE_SCHRITTE) / BEARBEITBARE_SCHRITTE) * 100),
    stammdaten,
    kmu,
    vollmacht,
    deminimisSumme,
    dokumente,
  }
}
