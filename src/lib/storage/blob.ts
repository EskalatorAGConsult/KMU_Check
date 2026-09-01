import 'server-only'

import { get, put } from '@vercel/blob'

/**
 * Dokumenten-Storage ueber Vercel Blob.
 *
 * Der Store „MABE" ist ein PRIVATER Store (Vercel-Standard bei neuen Stores):
 * Uploads muessen access: 'private' verwenden, und die Blob-URLs sind NICHT
 * oeffentlich abrufbar. Downloads laufen deshalb ueber authentifizierte
 * Proxy-Routen (Admin: /admin/dokument/[id] u. a.; Kunde: /konto/vorgang/[id]/…),
 * die serverseitig mit Token via ladeDokumentBuffer() streamen.
 * Legacy: BLOB_ACCESS=public stellt auf einen oeffentlichen Store um.
 *
 * Ohne Token wird null zurueckgegeben (Warnung im Log) – der Fachprozess
 * laeuft bewusst weiter (gleiches Best-Effort-Muster wie beim E-Mail-Versand).
 * Akzeptierte Variablennamen: BLOB_READ_WRITE_TOKEN (Standard) oder der
 * Store-praefixte Name MABE_READ_WRITE_TOKEN (Vercel vergibt ihn, wenn der
 * Blob-Store „MABE" heisst). Token anlegen: Vercel Dashboard -> Storage -> Blob.
 */
export function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN ?? process.env.MABE_READ_WRITE_TOKEN
}

/** Zugriffsmodus des Stores (private ist Vercel-Standard; public nur via ENV). */
export function blobZugriff(): 'private' | 'public' {
  return process.env.BLOB_ACCESS === 'public' ? 'public' : 'private'
}

/** Laedt Bytes in den Blob-Store und gibt die (private) Blob-URL zurueck. */
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
    access: blobZugriff(),
    contentType,
    addRandomSuffix: true,
    token,
  })
  return blob.url
}

export interface BlobInhalt {
  bytes: Uint8Array
  contentType: string
}

/**
 * Liest ein Dokument serverseitig aus dem (privaten) Store – Grundlage der
 * authentifizierten Proxy-Routen. Liefert null bei fehlendem Token oder
 * nicht gefundenem Blob.
 */
export async function ladeDokumentBuffer(urlOderPfad: string): Promise<BlobInhalt | null> {
  const token = blobToken()
  if (!token) return null
  const res = await get(urlOderPfad, { access: blobZugriff(), token })
  if (!res) return null
  const puffer = await new Response(res.stream).arrayBuffer()
  return {
    bytes: new Uint8Array(puffer),
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
  }
}
