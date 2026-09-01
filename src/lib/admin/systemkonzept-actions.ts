'use server'

import { list } from '@vercel/blob'

import { requireAdmin } from '@/lib/auth/guards'
import { supabaseServer } from '@/lib/db/server'
import { audit } from '@/lib/db/repositories/journey'
import { blobToken, ladeDokumentHoch } from '@/lib/storage/blob'

import { validierePdf } from './pdf-upload'

/**
 * Systemkonzept-Verwaltung im Admin (BAFA Modul 3, Merkblatt EEW Kap. 3.1:
 * „Systemkonzept mit Datenerfassungsplan"; ein „Wirkplan" ist bei uns NICHT
 * erforderlich).
 *
 * Zwei Wege pro Vorgang:
 * 1. Eigenes, kundenindividuelles PDF hochladen (wird im Blob archiviert).
 * 2. Standard-Vorlage aus dem Blob-Ordner vorlagen/systemkonzept/ waehlen.
 * In beiden Faellen wird die dokumente-Zeile (typ 'systemkonzept') ersetzt –
 * der Kunde sieht das Dokument dann in seiner Einreichungs-Uebersicht.
 */

export interface SystemkonzeptVorlage {
  url: string
  name: string
}

/** Listet die Standard-Systemkonzepte aus dem Blob (Ordner vorlagen/systemkonzept/). */
export async function listeSystemkonzeptVorlagen(): Promise<SystemkonzeptVorlage[]> {
  await requireAdmin()
  const token = blobToken()
  if (!token) return []
  try {
    const { blobs } = await list({ prefix: 'vorlagen/systemkonzept/', token, limit: 50 })
    return blobs
      .filter((b) => b.pathname.toLowerCase().endsWith('.pdf'))
      .map((b) => ({ url: b.url, name: b.pathname.split('/').pop() ?? b.pathname }))
  } catch (e) {
    console.error('[systemkonzept] Vorlagen-Liste fehlgeschlagen:', e)
    return []
  }
}

/** Ersetzt die dokumente-Zeile des Systemkonzepts und schreibt einen Audit-Eintrag. */
async function setzeDokument(angebotId: string, url: string, quelle: string, userId: string) {
  const db = supabaseServer()
  await db.from('dokumente').delete().eq('angebot_id', angebotId).eq('typ', 'systemkonzept')
  const { error } = await db.from('dokumente').insert({
    angebot_id: angebotId,
    typ: 'systemkonzept',
    storage_path: url,
  })
  if (error) throw new Error(`Dokumente: ${error.message}`)
  await audit(angebotId, `admin:${userId}`, 'systemkonzept_gesetzt', { quelle })
}

export type SystemkonzeptErgebnis = { ok: true; hinweis: string } | { ok: false; fehler: string }

/** Laedt ein kundenindividuelles Systemkonzept-PDF hoch und verknuepft es mit dem Vorgang. */
export async function ladeSystemkonzeptHoch(angebotId: string, formData: FormData): Promise<SystemkonzeptErgebnis> {
  const session = await requireAdmin()
  const geprueft = await validierePdf(formData)
  if ('fehler' in geprueft) return { ok: false, fehler: geprueft.fehler }

  try {
    const { data: angebot, error } = await supabaseServer()
      .from('angebote')
      .select('angebot_nr')
      .eq('id', angebotId)
      .single()
    if (error || !angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }

    const url = await ladeDokumentHoch(`systemkonzept/${angebot.angebot_nr}-upload.pdf`, geprueft.bytes)
    if (!url) return { ok: false, fehler: 'Storage nicht konfiguriert (Blob-Token fehlt).' }
    await setzeDokument(angebotId, url, `upload:${geprueft.name}`, session.user.id)
    return { ok: true, hinweis: 'Systemkonzept hochgeladen und dem Vorgang zugeordnet.' }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Upload fehlgeschlagen.' }
  }
}

/** Ordnet dem Vorgang eine Standard-Vorlage aus dem Blob zu (URL wird strikt geprueft). */
export async function waehleSystemkonzeptVorlage(angebotId: string, vorlageUrl: string): Promise<SystemkonzeptErgebnis> {
  const session = await requireAdmin()
  try {
    const u = new URL(vorlageUrl)
    const hostOk = u.hostname.endsWith('.blob.vercel-storage.com')
    const pfadOk = u.pathname.startsWith('/vorlagen/systemkonzept/') && u.pathname.toLowerCase().endsWith('.pdf')
    if (!hostOk || !pfadOk) {
      return { ok: false, fehler: 'Ungültige Vorlagen-URL (nur eigene Blob-Vorlagen erlaubt).' }
    }
    await setzeDokument(angebotId, vorlageUrl, `vorlage:${u.pathname.split('/').pop()}`, session.user.id)
    return { ok: true, hinweis: 'Standard-Systemkonzept zugeordnet.' }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Zuordnung fehlgeschlagen.' }
  }
}
