import 'server-only'

import { put } from '@vercel/blob'

/**
 * Dokumenten-Storage ueber Vercel Blob.
 *
 * Ohne Token wird null zurueckgegeben (Warnung im Log) – der Fachprozess
 * laeuft bewusst weiter (gleiches Best-Effort-Muster wie beim E-Mail-Versand).
 * Akzeptierte Variablennamen: BLOB_READ_WRITE_TOKEN (Standard) oder der
 * Store-praefixte Name MABE_READ_WRITE_TOKEN (Vercel vergibt ihn, wenn der
 * Blob-Store „MABE" heisst). Token anlegen: Vercel Dashboard -> Storage -> Blob.
 *
 * Hinweis: Die Blobs sind 'public', die URLs enthalten jedoch einen
 * Zufalls-Suffix und sind damit nicht aufzaehlbar. Sollen die Dokumente
 * kuenftig hinter Login liegen, auf access: 'private' + signierte
 * Download-URLs umstellen.
 */
export function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN ?? process.env.MABE_READ_WRITE_TOKEN
}

export async function ladeDokumentHoch(
  pfad: string,
  bytes: Uint8Array,
  contentType = 'application/pdf',
): Promise<string | null> {
  const token = blobToken()
  if (!token) {
    console.warn('[storage] BLOB_READ_WRITE_TOKEN fehlt – Upload von %s uebersprungen', pfad)
    return null
  }
  const blob = await put(pfad, Buffer.from(bytes), {
    access: 'public',
    contentType,
    addRandomSuffix: true,
    token,
  })
  return blob.url
}
