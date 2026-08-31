import 'server-only'

import { put } from '@vercel/blob'

/**
 * Dokumenten-Storage ueber Vercel Blob.
 *
 * Ohne BLOB_READ_WRITE_TOKEN wird null zurueckgegeben (Warnung im Log) –
 * der Fachprozess laeuft bewusst weiter (gleiches Best-Effort-Muster wie
 * beim E-Mail-Versand). Token anlegen: Vercel Dashboard -> Storage -> Blob.
 *
 * Hinweis: Die Blobs sind 'public', die URLs enthalten jedoch einen
 * Zufalls-Suffix und sind damit nicht aufzaehlbar. Sollen die Dokumente
 * kuenftig hinter Login liegen, auf access: 'private' + signierte
 * Download-URLs umstellen.
 */
export async function ladeDokumentHoch(
  pfad: string,
  bytes: Uint8Array,
  contentType = 'application/pdf',
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('[storage] BLOB_READ_WRITE_TOKEN fehlt – Upload von %s uebersprungen', pfad)
    return null
  }
  const blob = await put(pfad, Buffer.from(bytes), {
    access: 'public',
    contentType,
    addRandomSuffix: true,
  })
  return blob.url
}
