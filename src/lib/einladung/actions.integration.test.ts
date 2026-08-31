import { readFileSync } from 'node:fs'

import { afterAll, describe, expect, it } from 'vitest'

import { nehmeEinladungAn } from '@/lib/einladung/actions'

/**
 * Integrationstest des kompletten Einladungs-Flows gegen die echte Datenbank:
 * Einladung anlegen (SQL) -> nehmeEinladungAn -> Konto mit Rolle vorhanden,
 * Einladung verbraucht, Token danach ungueltig. Raumt danach auf.
 * Wird uebersprungen, wenn keine DATABASE_URL verfuegbar ist.
 */

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const HAT_DB = !!process.env.DATABASE_URL
const KLARTEXT = 'vitest-einladung-klartext-4711'
const EMAIL = 'vitest-einladung@example.invalid'

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

describe.skipIf(!HAT_DB)('Einladungs-Flow (Integration, echte DB)', async () => {
  afterAll(async () => {
    await sql('delete from "user" where email = $1', [EMAIL])
    await sql('delete from benutzer_einladungen where email = $1', [EMAIL])
  })

  it('vollstaendiger Ablauf: anlegen -> annehmen -> verbraucht', async () => {
    const { createHash } = await import('node:crypto')
    const hash = '\\x' + createHash('sha256').update(KLARTEXT, 'utf8').digest('hex')
    await sql('delete from benutzer_einladungen where email = $1', [EMAIL])
    await sql(
      "insert into benutzer_einladungen (email, rolle, token_hash, expires_at) values ($1, 'eskalator', $2, now() + interval '14 days')",
      [EMAIL, hash],
    )

    // Falsches Passwort-Format wird abgelehnt (zu kurz)
    const zuKurz = await nehmeEinladungAn({ token: KLARTEXT, name: 'Vitest Eskalator', password: 'kurz' })
    expect(zuKurz.ok).toBe(false)

    // Ungueltiger Token wird abgelehnt
    const falsch = await nehmeEinladungAn({ token: 'falscher-token', name: 'Vitest Eskalator', password: 'sicher-sicher-123' })
    expect(falsch.ok).toBe(false)

    // Annehmen mit gueltigem Token
    const res = await nehmeEinladungAn({ token: KLARTEXT, name: 'Vitest Eskalator', password: 'sicher-sicher-123' })
    expect(res).toEqual({ ok: true })

    // Konto existiert mit Rolle 'eskalator'
    const { rows: users } = await sql('select role from "user" where email = $1', [EMAIL])
    expect(users[0]?.role).toBe('eskalator')

    // Einladung ist verbraucht – zweites Annehmen scheitert
    const zweimal = await nehmeEinladungAn({ token: KLARTEXT, name: 'Vitest Eskalator', password: 'sicher-sicher-123' })
    expect(zweimal.ok).toBe(false)

    // Audit-Eintrag vorhanden
    const { rows: audits } = await sql("select aktion from audit_events where aktion = 'einladung_angenommen' and details->>'email' = $1", [EMAIL])
    expect(audits.length).toBeGreaterThan(0)
  }, 30_000)
})
