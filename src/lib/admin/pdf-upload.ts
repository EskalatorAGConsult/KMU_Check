import 'server-only'

/** Maximale Groesse eines hochgeladenen PDFs (Bytes). */
export const MAX_PDF_UPLOAD = 15 * 1024 * 1024

/**
 * Liest und validiert eine hochgeladene PDF-Datei aus einer FormData.
 * Der MIME-Type des Clients ist vertrauensunwuerdig – entscheidend sind
 * die PDF-Magic-Bytes (%PDF) am Dateianfang.
 */
export async function validierePdf(formData: FormData): Promise<{ bytes: Uint8Array; name: string } | { fehler: string }> {
  const datei = formData.get('datei')
  if (!(datei instanceof File) || datei.size === 0) return { fehler: 'Keine Datei übergeben.' }
  if (datei.size > MAX_PDF_UPLOAD) return { fehler: 'Die Datei ist größer als 15 MB.' }
  const bytes = new Uint8Array(await datei.arrayBuffer())
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    return { fehler: 'Die Datei ist keine PDF (unerwartetes Dateiformat).' }
  }
  return { bytes, name: datei.name }
}
