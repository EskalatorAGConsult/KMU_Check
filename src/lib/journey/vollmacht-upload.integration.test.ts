import { readFileSync } from 'node:fs'

import { afterAll, describe, expect, it } from 'vitest'

import { erstelleAngebot } from '@/lib/db/repositories/angebote'
import { erstelleJourneyToken } from '@/lib/db/repositories/journey'
import { ladeVollmachtUploadHoch } from '@/lib/journey/actions'
import { ladeDokumentBuffer } from '@/lib/storage/blob'

/**
 * Integrationstest des Vollmacht-Uploads (Download-/Upload-Strecke) gegen die
 * echte Datenbank UND den echten (privaten) Blob-Store:
 * Token -> Upload (Magic-Byte-Validierung) -> Blob lesbar -> Audit -> Guards.
 * Wird uebersprungen, wenn keine DATABASE_URL verfuegbar ist.
 */

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const HAT_DB = !!process.env.DATABASE_URL
const NR = `VITEST-UP-${Date.now()}`

/** Minimales, valides PDF (Header %PDF) fuer die Magic-Byte-Pruefung. */
const PDF_BYTES = new TextEncoder().encode('%PDF-1.4\n%vitest-vollmacht-upload\n')

function pdfFormData(): FormData {
  const fd = new FormData()
  fd.set('datei', new File([PDF_BYTES], 'vollmacht-test.pdf', { type: 'application/pdf' }))
  return fd
}

async function sql(anweisung: string, params: unknown[] = []) {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    return await client.query(anweisung, params)
  } finally {
    await client.end()
  }
}

describe.skipIf(!HAT_DB)('Vollmacht-Upload (Integration, echte DB + Blob)', () => {
  let angebotId = ''
  let blobUrl = ''

  afterAll(async () => {
    // Blob entfernen, dann Vorgang (Kaskade raeumt Token/Audit ab)
    if (blobUrl) {
      try {
        const { del } = await import('@vercel/blob')
        const token = process.env.BLOB_READ_WRITE_TOKEN ?? process.env.MABE_READ_WRITE_TOKEN
        if (token) await del(blobUrl, { token })
      } catch {
        /* best effort */
      }
    }
    if (angebotId) await sql('delete from angebote where id = $1', [angebotId])
  })

  it('komplette Strecke: Token -> Upload -> Blob lesbar -> Audit -> Guards', async () => {
    // angelegt_von referenziert die user-Tabelle (FK) – echten Admin nehmen
    const { rows: admins } = await sql("select id from \"user\" where role in ('admin','vertrieb','eskalator') limit 1")
    expect(admins.length).toBe(1)

    angebotId = await erstelleAngebot(admins[0].id as string, {
      kunde_firma: 'Vitest Upload GmbH',
      kunde_email: 'vitest-upload@example.invalid',
      angebot_nr: NR,
      angebot_datum: '2026-09-04',
      technologien: ['messtechnik'],
    })
    const klartext = await erstelleJourneyToken(angebotId)

    // 1 · Ungueltiger Token wird abgelehnt
    const falscherToken = await ladeVollmachtUploadHoch('vitest-falscher-token', pdfFormData())
    expect(falscherToken.ok).toBe(false)

    // 2 · Kein PDF (Magic-Bytes fehlen) wird abgelehnt
    const txt = new FormData()
    txt.set('datei', new File([new TextEncoder().encode('nur text')], 'notiz.txt', { type: 'text/plain' }))
    const keinPdf = await ladeVollmachtUploadHoch(klartext, txt)
    expect(keinPdf.ok).toBe(false)

    // 3 · Valider Upload landet im privaten Blob und ist serverseitig lesbar
    const hoch = await ladeVollmachtUploadHoch(klartext, pdfFormData())
    expect(hoch.ok).toBe(true)
    if (hoch.ok) {
      blobUrl = hoch.pfad
      // Der Blob-Pfad traegt einen Zufalls-Suffix (addRandomSuffix) –
      // entscheidend sind Ordner, Angebotsnummer und Endung.
      expect(hoch.pfad).toContain(`vollmacht-upload/${NR}-`)
      expect(hoch.pfad).toMatch(/\.pdf$/)
      expect(hoch.pfad).toContain('.blob.vercel-storage.com/')
    }
    const inhalt = await ladeDokumentBuffer(blobUrl)
    expect(inhalt).not.toBeNull()
    expect(inhalt!.contentType).toBe('application/pdf')
    expect(inhalt!.bytes.slice(0, 4)).toEqual(PDF_BYTES.slice(0, 4))

    // 4 · Audit-Eintrag vorhanden
    const { rows: audits } = await sql(
      "select aktion from audit_events where angebot_id = $1 and aktion = 'vollmacht_upload'",
      [angebotId],
    )
    expect(audits.length).toBeGreaterThan(0)

    // 5 · Guard: nach Einreichung ist kein Upload mehr moeglich
    await sql("update angebote set status = 'eingereicht' where id = $1", [angebotId])
    const nachEinreichung = await ladeVollmachtUploadHoch(klartext, pdfFormData())
    expect(nachEinreichung.ok).toBe(false)
    if (!nachEinreichung.ok) expect(nachEinreichung.fehler).toMatch(/eingereicht/)
  }, 60_000)
})
