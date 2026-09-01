import 'server-only'

import { supabaseServer } from '@/lib/db/server'
import { listeRevisionen } from '@/lib/db/repositories/revisionen'
import type {
  Angebot,
  AngebotStatus,
  AuditEventRow,
  BeteiligungRow,
  DeminimisBeihilfeRow,
  DeminimisErklaerungRow,
  DokumentRow,
  KmuBewertungRow,
  StammdatenRow,
  UebergabeRow,
  VollmachtRow,
  VorgangRevisionRow,
} from '@/lib/db/types'

/**
 * Kunden-Repository (Admin): aggregiert Vorgänge pro Kunden-E-Mail und
 * reichert sie mit Registrierungsstatus (Better-Auth-User, Rolle 'kunde')
 * an. Aufrufer muessen vorher requireAdmin() durchlaufen haben.
 */

export interface KundeUebersicht {
  email: string
  firma: string
  anzahlVorgaenge: number
  status: AngebotStatus[]
  registriert: boolean
  letzterVorgang: string // ISO-Datum
}

interface AngebotZeile {
  id: string
  kunde_email: string
  kunde_firma: string
  status: AngebotStatus
  created_at: string
}

export async function listeKunden(): Promise<KundeUebersicht[]> {
  const db = supabaseServer()
  const [{ data: angebote, error: e1 }, { data: kundenUser, error: e2 }] = await Promise.all([
    db
      .from('angebote')
      .select('id, kunde_email, kunde_firma, status, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    db.from('user').select('email').eq('role', 'kunde'),
  ])
  if (e1) throw new Error(`Kunden konnten nicht geladen werden: ${e1.message}`)
  if (e2) throw new Error(`Kundenkonten konnten nicht geladen werden: ${e2.message}`)

  const registrierteMails = new Set((kundenUser ?? []).map((u) => (u.email as string).toLowerCase()))
  const nachMail = new Map<string, KundeUebersicht>()

  for (const a of (angebote ?? []) as AngebotZeile[]) {
    const schluessel = a.kunde_email.toLowerCase()
    const vorhanden = nachMail.get(schluessel)
    if (vorhanden) {
      vorhanden.anzahlVorgaenge += 1
      vorhanden.status.push(a.status)
      if (a.created_at > vorhanden.letzterVorgang) {
        vorhanden.letzterVorgang = a.created_at
        vorhanden.firma = a.kunde_firma
      }
    } else {
      nachMail.set(schluessel, {
        email: a.kunde_email,
        firma: a.kunde_firma,
        anzahlVorgaenge: 1,
        status: [a.status],
        registriert: registrierteMails.has(schluessel),
        letzterVorgang: a.created_at,
      })
    }
  }

  return [...nachMail.values()].sort((a, b) => b.letzterVorgang.localeCompare(a.letzterVorgang))
}

export interface JourneyEntwurf {
  aktueller_schritt: string
  schritte: Record<string, Record<string, unknown>>
  updated_at: string
}

/** Vollstaendiger fachlicher Auszug eines Vorgangs (BAFA-Arbeitsplatz). */
export interface KundeVorgang {
  angebot: Angebot
  stammdaten: StammdatenRow | null
  beteiligungen: BeteiligungRow[]
  kmuBewertungen: KmuBewertungRow[]
  deminimis: DeminimisErklaerungRow | null
  beihilfen: DeminimisBeihilfeRow[]
  vollmacht: VollmachtRow | null
  dokumente: DokumentRow[]
  /** Entwurfsdaten (Speichern & Fortsetzen) – bleibt auch nach Einreichung erhalten. */
  entwurf: JourneyEntwurf | null
  uebergaben: UebergabeRow[]
  audit: AuditEventRow[]
  /** Admin-Aenderungshistorie (Migration 19), neueste zuerst. */
  revisionen: VorgangRevisionRow[]
}

export interface KundeDetail {
  email: string
  firma: string
  registriert: boolean
  kontoName: string | null
  vorgaenge: KundeVorgang[]
}

/** Max. Eintraege pro Vorgang in den Log-Listen (Seite bleibt kompakt). */
const MAX_UEBERGABEN = 5
const MAX_AUDIT = 10

export async function holeKunde(email: string): Promise<KundeDetail | null> {
  const db = supabaseServer()
  const { data: angebote, error } = await db
    .from('angebote')
    .select('*')
    .ilike('kunde_email', email)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Kunde konnte nicht geladen werden: ${error.message}`)
  if (!angebote || angebote.length === 0) return null

  const ids = angebote.map((a) => a.id as string)
  const [stammRes, betRes, kmuRes, demRes, behRes, vollRes, dokRes, fortRes, uebRes, audRes, userRes] =
    await Promise.all([
      db.from('stammdaten').select('*').in('angebot_id', ids),
      db.from('beteiligungen').select('*').in('angebot_id', ids).order('created_at', { ascending: true }),
      db
        .from('kmu_bewertungen')
        .select('*')
        .in('angebot_id', ids)
        .order('geschaeftsjahr', { ascending: false }),
      db.from('deminimis_erklaerungen').select('*').in('angebot_id', ids),
      db
        .from('deminimis_beihilfen')
        .select('*')
        .in('angebot_id', ids)
        .order('bewilligt_am', { ascending: false }),
      db.from('vollmachten').select('*').in('angebot_id', ids),
      db.from('dokumente').select('*').in('angebot_id', ids).order('created_at', { ascending: false }),
      db.from('journey_fortschritt').select('angebot_id, aktueller_schritt, schritte, updated_at').in('angebot_id', ids),
      db
        .from('uebergaben')
        .select('id, angebot_id, http_status, erfolg, versucht_at')
        .in('angebot_id', ids)
        .order('versucht_at', { ascending: false }),
      db
        .from('audit_events')
        .select('id, angebot_id, actor, aktion, details, created_at')
        .in('angebot_id', ids)
        .order('created_at', { ascending: false })
        .limit(ids.length * MAX_AUDIT * 2),
      db.from('user').select('name, email').ilike('email', email).eq('role', 'kunde').maybeSingle(),
    ])

  const stammNachAngebot = new Map((stammRes.data ?? []).map((s) => [s.angebot_id as string, s as StammdatenRow]))
  const demNachAngebot = new Map(
    (demRes.data ?? []).map((d) => [d.angebot_id as string, d as DeminimisErklaerungRow]),
  )
  const vollNachAngebot = new Map((vollRes.data ?? []).map((v) => [v.angebot_id as string, v as VollmachtRow]))
  const entwurfNachAngebot = new Map(
    (fortRes.data ?? []).map((f) => [
      f.angebot_id as string,
      {
        aktueller_schritt: f.aktueller_schritt as string,
        schritte: (f.schritte ?? {}) as Record<string, Record<string, unknown>>,
        updated_at: f.updated_at as string,
      } satisfies JourneyEntwurf,
    ]),
  )

  const gruppiere = <T extends { angebot_id: string | null }>(zeilen: T[] | null, limit?: number) => {
    const map = new Map<string, T[]>()
    for (const z of zeilen ?? []) {
      if (!z.angebot_id) continue
      const liste = map.get(z.angebot_id) ?? []
      if (limit === undefined || liste.length < limit) liste.push(z)
      map.set(z.angebot_id, liste)
    }
    return map
  }
  const betNachAngebot = gruppiere((betRes.data ?? []) as BeteiligungRow[])
  const kmuNachAngebot = gruppiere((kmuRes.data ?? []) as KmuBewertungRow[])
  const behNachAngebot = gruppiere((behRes.data ?? []) as DeminimisBeihilfeRow[])
  const dokNachAngebot = gruppiere((dokRes.data ?? []) as DokumentRow[])
  const uebNachAngebot = gruppiere((uebRes.data ?? []) as UebergabeRow[], MAX_UEBERGABEN)
  const audNachAngebot = gruppiere((audRes.data ?? []) as AuditEventRow[], MAX_AUDIT)

  // Revisionshistorie (Migration 19) separat laden und je Vorgang gruppieren
  const revisionen = await listeRevisionen(ids)
  const revNachAngebot = gruppiere(revisionen)

  const juengster = angebote[0] as Angebot
  return {
    email: juengster.kunde_email,
    firma: juengster.kunde_firma,
    registriert: !!userRes.data,
    kontoName: (userRes.data?.name as string | undefined) ?? null,
    vorgaenge: (angebote as Angebot[]).map((a) => ({
      angebot: a,
      stammdaten: stammNachAngebot.get(a.id) ?? null,
      beteiligungen: betNachAngebot.get(a.id) ?? [],
      kmuBewertungen: kmuNachAngebot.get(a.id) ?? [],
      deminimis: demNachAngebot.get(a.id) ?? null,
      beihilfen: behNachAngebot.get(a.id) ?? [],
      vollmacht: vollNachAngebot.get(a.id) ?? null,
      dokumente: dokNachAngebot.get(a.id) ?? [],
      entwurf: entwurfNachAngebot.get(a.id) ?? null,
      uebergaben: uebNachAngebot.get(a.id) ?? [],
      audit: audNachAngebot.get(a.id) ?? [],
      revisionen: revNachAngebot.get(a.id) ?? [],
    })),
  }
}
