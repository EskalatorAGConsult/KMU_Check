import 'server-only'

/**
 * Upload-Vertrag fuer den generischen Dokumenten-Upload (Admin).
 * Erlaubt: PDF, PNG, JPG – erkannt an den Magic-Bytes (der MIME-Type des
 * Clients ist vertrauensunwuerdig). Groessenlimit 15 MB.
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

export interface ValidDatei {
  bytes: Uint8Array
  name: string
  contentType: 'application/pdf' | 'image/png' | 'image/jpeg'
}

function erkenneContentType(b: Uint8Array): ValidDatei['contentType'] | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf' // %PDF
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png' // ‰PNG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  return null
}

/** Dateiname fuer den Storage-Pfad bereinigen (keine Pfad-Bestandteile/Sonderzeichen). */
export function bereinigeDateiname(name: string): string {
  const basis = name.split(/[\\/]/).pop() ?? 'datei'
  return basis.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'datei'
}

export async function validiereUploadDatei(formData: FormData): Promise<ValidDatei | { fehler: string }> {
  const datei = formData.get('datei')
  if (!(datei instanceof File) || datei.size === 0) return { fehler: 'Keine Datei übergeben.' }
  if (datei.size > MAX_UPLOAD_BYTES) return { fehler: 'Die Datei ist größer als 15 MB.' }
  const bytes = new Uint8Array(await datei.arrayBuffer())
  const contentType = erkenneContentType(bytes)
  if (!contentType) {
    return { fehler: 'Nur PDF-, PNG- oder JPG-Dateien sind erlaubt (unerwartetes Dateiformat).' }
  }
  return { bytes, name: bereinigeDateiname(datei.name), contentType }
}
