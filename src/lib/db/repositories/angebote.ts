import 'server-only'

import { supabaseServer } from '@/lib/db/server'
import type { Angebot, AngebotStatus, Technologie } from '@/lib/db/types'

/** Admin-Repositories: alle Aufrufer muessen vorher requireAdmin() durchlaufen. */

export interface AngebotListeItem {
  id: string
  status: AngebotStatus
  kunde_firma: string
  kunde_email: string
  angebot_nr: string
  angebot_datum: string
  created_at: string
}

export async function listeAngebote(): Promise<AngebotListeItem[]> {
  const { data, error } = await supabaseServer()
    .from('angebote')
    .select('id, status, kunde_firma, kunde_email, angebot_nr, angebot_datum, created_at')
    .order('created_at', { ascending: false })
    .limit(1000) // clientseitige Blätterfunktion im Admin-Dashboard (Filter/Suche lokal)
  if (error) throw new Error(`Angebote konnten nicht geladen werden: ${error.message}`)
  return data ?? []
}

export interface NeuesAngebot {
  kunde_firma: string
  kunde_ansprechpartner?: string
  kunde_email: string
  angebot_nr: string
  angebot_datum: string
  technologien: Technologie[]
  software_variante?: string
  invest_software?: number
  invest_messtechnik?: number
  invest_steuerung?: number
  sensoren_gesamt?: number
  sensoren_prozessbezug?: number
  projektende?: string
  notiz?: string
  /** Gemini-Rohextraktion aus dem Angebots-PDF (Nachweis + spaetere Auswertung). */
  extraktion?: Record<string, unknown>
}

export async function erstelleAngebot(userId: string, eingabe: NeuesAngebot): Promise<string> {
  const { data, error } = await supabaseServer()
    .from('angebote')
    .insert({
      angelegt_von: userId,
      status: 'angelegt',
      kunde_firma: eingabe.kunde_firma,
      kunde_ansprechpartner: eingabe.kunde_ansprechpartner ?? null,
      kunde_email: eingabe.kunde_email,
      angebot_nr: eingabe.angebot_nr,
      angebot_datum: eingabe.angebot_datum,
      technologien: eingabe.technologien,
      software_variante: eingabe.software_variante ?? null,
      invest_software: eingabe.invest_software ?? null,
      invest_messtechnik: eingabe.invest_messtechnik ?? null,
      invest_steuerung: eingabe.invest_steuerung ?? null,
      sensoren_gesamt: eingabe.sensoren_gesamt ?? null,
      sensoren_prozessbezug: eingabe.sensoren_prozessbezug ?? null,
      projektende: eingabe.projektende ?? null,
      notiz: eingabe.notiz ?? null,
      extraktion: eingabe.extraktion ?? null,
      extrahiert_am: eingabe.extraktion ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Angebot konnte nicht angelegt werden: ${error.message}`)
  return data.id as string
}

export async function holeAngebot(id: string): Promise<Angebot | null> {
  const { data, error } = await supabaseServer().from('angebote').select('*').eq('id', id).maybeSingle<Angebot>()
  if (error) throw new Error(`Angebot konnte nicht geladen werden: ${error.message}`)
  return data ?? null
}

/**
 * Loescht einen Vorgang samt aller abhaengigen Daten (DSGVO Art. 17).
 * Die DB-Kaskade (on delete cascade) entfernt Stammdaten, KMU, Beteiligungen,
 * De-minimis, Vollmacht, Tokens, Fortschritt, Zugriffe, Notizen, Revisionen.
 */
export async function loescheAngebot(id: string): Promise<void> {
  const { error } = await supabaseServer().from('angebote').delete().eq('id', id)
  if (error) throw new Error(`Vorgang konnte nicht gelöscht werden: ${error.message}`)
}
