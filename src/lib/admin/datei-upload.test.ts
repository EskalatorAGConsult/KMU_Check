import { describe, expect, it } from 'vitest'

import { bereinigeDateiname, MAX_UPLOAD_BYTES, validiereUploadDatei } from './datei-upload'

/**
 * Upload-Vertrag (Sicherheit): Nur PDF/PNG/JPG per Magic-Bytes, Groessenlimit,
 * Dateiname-Sanitizing gegen Path-Traversal. Der Client-MIME-Type ist
 * vertrauensunwuerdig – entscheidend ist der Inhalt.
 */

function formDataMit(bytes: number[], name: string): FormData {
  const fd = new FormData()
  fd.set('datei', new File([new Uint8Array(bytes)], name))
  return fd
}

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d]
const JPG = [0xff, 0xd8, 0xff, 0xe0]
const EXE = [0x4d, 0x5a, 0x90, 0x00] // Windows-Executable

describe('validiereUploadDatei (Magic-Bytes statt MIME-Vertrauen)', () => {
  it('akzeptiert PDF, PNG und JPG am Inhalt erkannt', async () => {
    for (const bytes of [PDF, PNG, JPG]) {
      const r = await validiereUploadDatei(formDataMit(bytes, 'dokument.pdf'))
      expect('fehler' in r).toBe(false)
    }
  })

  it('weist Executables und Textdateien ab – auch mit PDF-Dateinamen', async () => {
    for (const bytes of [EXE, [0x48, 0x65, 0x6c, 0x6c, 0x6f]]) {
      const r = await validiereUploadDatei(formDataMit(bytes, 'vollmacht.pdf'))
      expect('fehler' in r).toBe(true)
    }
  })

  it('weist fehlende oder leere Dateien ab', async () => {
    expect('fehler' in await validiereUploadDatei(new FormData())).toBe(true)
    expect('fehler' in await validiereUploadDatei(formDataMit([], 'leer.pdf'))).toBe(true)
  })

  it('erzwingt das Groessenlimit (15 MB)', async () => {
    const fd = new FormData()
    const blob = new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)])
    fd.set('datei', new File([blob], 'riesig.pdf'))
    const r = await validiereUploadDatei(fd)
    expect('fehler' in r).toBe(true)
    if ('fehler' in r) expect(r.fehler).toMatch(/15 MB/)
  })
})

describe('bereinigeDateiname (Path-Traversal-Schutz)', () => {
  it('entfernt Pfad-Bestandteile und Sonderzeichen', () => {
    // Path-Traversal wird auf den Basisnamen reduziert
    expect(bereinigeDateiname('../../etc/passwd')).toBe('passwd')
    expect(bereinigeDateiname('..\\..\\windows\\system32\\config')).toBe('config')
    expect(bereinigeDateiname('Vollmacht Muster GmbH (2026).pdf')).toBe('Vollmacht_Muster_GmbH__2026_.pdf')
  })

  it('behaelt nur den Dateinamen und begrenzt die Laenge', () => {
    expect(bereinigeDateiname('a/b/c/dokument.pdf')).toBe('dokument.pdf')
    expect(bereinigeDateiname('x'.repeat(200) + '.pdf').length).toBeLessThanOrEqual(80)
  })
})
