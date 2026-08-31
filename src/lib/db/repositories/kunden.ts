import 'server-only'

import { supabaseServer } from '@/lib/db/server'
import type { Angebot, AngebotStatus } from '@/lib/db/types'

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

export interface KundeVorgang {
  angebot: Angebot
  kmu: { kategorie: string; foerderquote_pct: number } | null
  hatStammdaten: boolean
  dokumente: { typ: string; storage_path: string }[]
}

export interface KundeDetail {
  email: string
  firma: string
  registriert: boolean
  kontoName: string | null
  vorgaenge: KundeVorgang[]
}

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
  const [kmuRes, stammRes, dokRes, userRes] = await Promise.all([
    db.from('kmu_bewertungen').select('angebot_id, kategorie, foerderquote_pct, created_at').in('angebot_id', ids).order('geschaeftsjahr', { ascending: false }),
    db.from('stammdaten').select('angebot_id').in('angebot_id', ids),
    db.from('dokumente').select('angebot_id, typ, storage_path').in('angebot_id', ids),
    db.from('user').select('name, email').ilike('email', email).eq('role', 'kunde').maybeSingle(),
  ])

  const kmuNachAngebot = new Map<string, KundeVorgang['kmu']>()
  for (const k of kmuRes.data ?? []) {
    // juengste Bewertung gewinnt (created_at absteigend nicht garantiert -> vergleichen)
    const bestehende = kmuNachAngebot.get(k.angebot_id as string)
    if (!bestehende) kmuNachAngebot.set(k.angebot_id as string, { kategorie: k.kategorie, foerderquote_pct: k.foerderquote_pct })
  }
  const stammdatenVorhanden = new Set((stammRes.data ?? []).map((s) => s.angebot_id as string))
  const dokNachAngebot = new Map<string, { typ: string; storage_path: string }[]>()
  for (const d of dokRes.data ?? []) {
    const liste = dokNachAngebot.get(d.angebot_id as string) ?? []
    liste.push({ typ: d.typ, storage_path: d.storage_path })
    dokNachAngebot.set(d.angebot_id as string, liste)
  }

  const juengster = angebote[0] as Angebot
  return {
    email: juengster.kunde_email,
    firma: juengster.kunde_firma,
    registriert: !!userRes.data,
    kontoName: (userRes.data?.name as string | undefined) ?? null,
    vorgaenge: (angebote as Angebot[]).map((a) => ({
      angebot: a,
      kmu: kmuNachAngebot.get(a.id) ?? null,
      hatStammdaten: stammdatenVorhanden.has(a.id),
      dokumente: dokNachAngebot.get(a.id) ?? [],
    })),
  }
}
