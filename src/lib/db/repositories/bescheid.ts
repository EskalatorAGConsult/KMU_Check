import 'server-only'

import { supabaseServer } from '@/lib/db/server'
import type { BescheidRow, VerwendungsnachweisRow, VnwBelegKategorie, VnwBelegRow } from '@/lib/db/types'

/**
 * Bescheid-/Verwendungsnachweis-Repository (Migration 25).
 * Autorisierung läuft über die Aufrufer: Server Actions prüfen VOR jedem
 * Zugriff den Vorgangszugriff (Admin-Session oder angebot_zugriffe) –
 * dieses Repository ist bewusst frei von Guards (gleiches Muster wie die
 * übrigen Repositories).
 */

// ---------- Lesen ----------

export interface BescheidDokumentVerweis {
  id: string
  storage_path: string
  created_at: string
}

/** Bescheid-Zeile + die aktuelle Bescheid-Datei (dokumente typ 'bescheid'). */
export async function holeBescheidBundle(
  angebotId: string,
): Promise<{ bescheid: BescheidRow | null; dokument: BescheidDokumentVerweis | null } | null> {
  const db = supabaseServer()
  const [besRes, dokRes] = await Promise.all([
    db.from('bescheide').select('*').eq('angebot_id', angebotId).maybeSingle(),
    db
      .from('dokumente')
      .select('id, storage_path, created_at')
      .eq('angebot_id', angebotId)
      .eq('typ', 'bescheid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (besRes.error) throw new Error(`Bescheid konnte nicht geladen werden: ${besRes.error.message}`)
  return {
    bescheid: (besRes.data as BescheidRow | null) ?? null,
    dokument: (dokRes.data as BescheidDokumentVerweis | null) ?? null,
  }
}

export async function holeVerwendungsnachweis(angebotId: string): Promise<VerwendungsnachweisRow | null> {
  const { data, error } = await supabaseServer()
    .from('verwendungsnachweise')
    .select('*')
    .eq('angebot_id', angebotId)
    .maybeSingle()
  if (error) throw new Error(`Verwendungsnachweis konnte nicht geladen werden: ${error.message}`)
  return (data as VerwendungsnachweisRow | null) ?? null
}

export interface VnwBelegMitDokument extends VnwBelegRow {
  dokument: { id: string; storage_path: string; created_at: string }
}

/** Alle Belege eines Vorgangs (älteste zuerst – Reihenfolge des Hochladens). */
export async function listeVnwBelege(angebotId: string): Promise<VnwBelegMitDokument[]> {
  const { data, error } = await supabaseServer()
    .from('vnw_belege')
    .select('id, angebot_id, dokument_id, kategorie, betrag_eur, created_at, dokumente(id, storage_path, created_at)')
    .eq('angebot_id', angebotId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Belege konnten nicht geladen werden: ${error.message}`)
  const zeilen = (data ?? []) as unknown as Array<
    VnwBelegRow & { dokumente: BescheidDokumentVerweis | BescheidDokumentVerweis[] | null }
  >
  return zeilen.map((z) => ({
    id: z.id,
    angebot_id: z.angebot_id,
    dokument_id: z.dokument_id,
    kategorie: z.kategorie,
    betrag_eur: z.betrag_eur,
    created_at: z.created_at,
    dokument: Array.isArray(z.dokumente) ? z.dokumente[0] : (z.dokumente ?? { id: z.dokument_id, storage_path: '', created_at: z.created_at }),
  }))
}

// ---------- Bescheid schreiben ----------

/** Legt die Bescheid-Zeile beim ersten Upload an (idempotent: Update nur ocr/ocr_am). */
export async function vermerkeBescheidUpload(
  angebotId: string,
  userId: string,
  ocr: Record<string, unknown> | null,
): Promise<BescheidRow> {
  const db = supabaseServer()
  const { data, error } = await db
    .from('bescheide')
    .upsert(
      {
        angebot_id: angebotId,
        hochgeladen_von: userId,
        ...(ocr ? { ocr, ocr_am: new Date().toISOString() } : {}),
      },
      { onConflict: 'angebot_id' },
    )
    .select('*')
    .single()
  if (error) throw new Error(`Bescheid konnte nicht gespeichert werden: ${error.message}`)
  return data as BescheidRow
}

export interface BescheidDatenEingabe {
  aktenzeichen: string | null
  bewilligt_am: string | null
  foerderquote_pct: 25 | 35 | 45 | null
  foerdersumme_eur: number | null
  durchfuehrung_von: string | null
  durchfuehrung_bis: string | null
  vnw_frist_am: string | null
  auflagen: string[]
  notiz: string | null
}

/** Schreibt die geprüften Bescheid-Daten + Bestätigungsnachweis (wer/wann). */
export async function speichereBescheidDaten(
  angebotId: string,
  userId: string,
  daten: BescheidDatenEingabe,
): Promise<void> {
  const { error } = await supabaseServer()
    .from('bescheide')
    .update({
      ...daten,
      bestaetigt_am: new Date().toISOString(),
      bestaetigt_von: userId,
    })
    .eq('angebot_id', angebotId)
  if (error) throw new Error(`Bescheid-Daten konnten nicht gespeichert werden: ${error.message}`)
}

/**
 * Referenziert die Bescheid-Datei: dokumente(typ 'bescheid') wird ersetzt
 * (letzter Upload gewinnt, Muster wie angebot_pdf) und liefert die neue ID.
 */
export async function referenziereBescheidDokument(
  angebotId: string,
  blobUrl: string,
): Promise<string> {
  const db = supabaseServer()
  await db.from('dokumente').delete().eq('angebot_id', angebotId).eq('typ', 'bescheid')
  const { data, error } = await db
    .from('dokumente')
    .insert({ angebot_id: angebotId, typ: 'bescheid', storage_path: blobUrl })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`Bescheid-Dokument konnte nicht referenziert werden: ${error?.message ?? 'unbekannter Fehler'}`)
  }
  return data.id as string
}

// ---------- Verwendungsnachweis ----------

/**
 * Legt die VNW-Zeile lazy an (mit dem ersten Bescheid) und snapshotet die
 * Frist aus dem Bescheid, sobald beide existieren. Idempotent.
 */
export async function stelleVnwSicher(angebotId: string, fristAusBescheid?: string | null): Promise<void> {
  const db = supabaseServer()
  const { data: vorhanden } = await db
    .from('verwendungsnachweise')
    .select('angebot_id, vorlagefrist_am')
    .eq('angebot_id', angebotId)
    .maybeSingle()
  if (!vorhanden) {
    const { error } = await db.from('verwendungsnachweise').insert({
      angebot_id: angebotId,
      status: 'offen',
      ...(fristAusBescheid ? { vorlagefrist_am: fristAusBescheid } : {}),
    })
    if (error) throw new Error(`Verwendungsnachweis konnte nicht angelegt werden: ${error.message}`)
    return
  }
  // Frist-Snapshot nachziehen, falls der Bescheid sie nachliefert und noch
  // kein manueller Wert gesetzt wurde.
  if (fristAusBescheid && !vorhanden.vorlagefrist_am) {
    const { error } = await db
      .from('verwendungsnachweise')
      .update({ vorlagefrist_am: fristAusBescheid })
      .eq('angebot_id', angebotId)
    if (error) throw new Error(`VNW-Frist konnte nicht übernommen werden: ${error.message}`)
  }
}

/** Aktualisiert Zeitraum/Frist am Bescheid UND snapshottet die Frist am VNW. */
export async function speichereZeitraumUndFrist(
  angebotId: string,
  von: string | null,
  bis: string | null,
  fristAm: string | null,
): Promise<void> {
  const db = supabaseServer()
  const { error: e1 } = await db
    .from('bescheide')
    .update({ durchfuehrung_von: von, durchfuehrung_bis: bis, vnw_frist_am: fristAm })
    .eq('angebot_id', angebotId)
  if (e1) throw new Error(`Zeitraum konnte nicht gespeichert werden: ${e1.message}`)
  // VNW-Snapshot mitschreiben (Vorrang-Regel der Domain: VNW-Wert wirkt).
  const { error: e2 } = await db
    .from('verwendungsnachweise')
    .update({ vorlagefrist_am: fristAm })
    .eq('angebot_id', angebotId)
  if (e2) throw new Error(`VNW-Frist konnte nicht gespeichert werden: ${e2.message}`)
}

export async function speichereSachbericht(angebotId: string, sachbericht: string | null): Promise<void> {
  const { error } = await supabaseServer()
    .from('verwendungsnachweise')
    .update({ sachbericht, status: 'in_bearbeitung' })
    .eq('angebot_id', angebotId)
  if (error) throw new Error(`Sachbericht konnte nicht gespeichert werden: ${error.message}`)
}

export async function markiereVnwEingereicht(angebotId: string, userId: string): Promise<void> {
  const { error } = await supabaseServer()
    .from('verwendungsnachweise')
    .update({ status: 'eingereicht', eingereicht_am: new Date().toISOString(), eingereicht_von: userId })
    .eq('angebot_id', angebotId)
  if (error) throw new Error(`Verwendungsnachweis konnte nicht abgeschlossen werden: ${error.message}`)
}

// ---------- Belege ----------

export async function fuegeBelegHinzu(
  angebotId: string,
  dokumentId: string,
  kategorie: VnwBelegKategorie,
  betragEur: number | null,
): Promise<VnwBelegRow> {
  const { data, error } = await supabaseServer()
    .from('vnw_belege')
    .insert({ angebot_id: angebotId, dokument_id: dokumentId, kategorie, betrag_eur: betragEur })
    .select('id, angebot_id, dokument_id, kategorie, betrag_eur, created_at')
    .single()
  if (error) throw new Error(`Beleg konnte nicht gespeichert werden: ${error.message}`)
  return data as VnwBelegRow
}

/** Löscht eine Beleg-Zeile (Kontrolle beim Aufrufer: Besitz + noch offen). */
export async function loescheBeleg(angebotId: string, belegId: string): Promise<void> {
  const { error } = await supabaseServer()
    .from('vnw_belege')
    .delete()
    .eq('id', belegId)
    .eq('angebot_id', angebotId)
  if (error) throw new Error(`Beleg konnte nicht gelöscht werden: ${error.message}`)
}
