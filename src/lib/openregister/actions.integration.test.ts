import { readFileSync } from 'node:fs'

import { afterAll, describe, expect, it } from 'vitest'

import { openregisterSuche, openregisterVerbund } from '@/lib/openregister/actions'

/**
 * Live-Integrationstest der OpenRegister-Anbindung gegen die echte API und
 * Datenbank: Suche -> Verbund-Abfrage (Details + Gesellschafter + Holdings)
 * -> Cache-Treffer beim zweiten Abruf -> Audit-Eintrag. Raumt auf.
 *
 * WICHTIG: Kostet echte API-Credits (~40). Laeuft NUR mit RUN_LIVE_TESTS=1,
 * im normalen `npm test` wird er uebersprungen.
 */

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const LIVE = !!process.env.RUN_LIVE_TESTS && !!process.env.OPENREGISTER_API_KEY && !!process.env.DATABASE_URL
const KLARTEXT = 'vitest-openregister-token-4711'
const MABE_ID = 'DE-HRB-T2214-1054' // Maschinen- und Behaelterbau GmbH, Daaden

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

describe.skipIf(!LIVE)('OpenRegister-Anbindung (Live-Integration)', async () => {
  let angebotId: string | null = null

  afterAll(async () => {
    if (angebotId) await sql('delete from angebote where id = $1', [angebotId])
    await sql("delete from openregister_cache where company_id like 'DE-HRB-T2214-%'")
  })

  it('Suche, Verbund-Abfrage, Cache und Audit funktionieren End-to-End', async () => {
    // Test-Vorgang + Journey-Token anlegen
    const { createHash } = await import('node:crypto')
    const hash = '\\x' + createHash('sha256').update(KLARTEXT, 'utf8').digest('hex')
    const { rows: users } = await sql('select id from "user" limit 1')
    const { rows: angebote } = await sql(
      `insert into angebote (angelegt_von, status, kunde_firma, kunde_email, angebot_nr, angebot_datum, technologien)
       values ($1, 'eingeladen', 'Vitest OpenRegister GmbH', 'vitest@example.invalid', 'ANG-VITEST-OR', current_date, array['messtechnik']::technologie[])
       returning id`,
      [users[0].id],
    )
    angebotId = angebote[0].id
    await sql(
      "insert into journey_tokens (angebot_id, token_hash, expires_at) values ($1, $2, now() + interval '1 day')",
      [angebotId, hash],
    )

    // 1 · Ungueltiger Token wird abgelehnt
    const ungueltig = await openregisterSuche('falscher-token', 'MABE')
    expect(ungueltig.ok).toBe(false)

    // 2 · Suche findet MABE
    const suche = await openregisterSuche(KLARTEXT, 'MABE Behälterbau Daaden')
    expect(suche.ok).toBe(true)
    if (suche.ok) expect(suche.treffer.length).toBeGreaterThan(0)

    // 3 · Verbund-Abfrage: Walter Henrich GmbH als 100-%-Gesellschafter (aufwaerts)
    const verbund = await openregisterVerbund(KLARTEXT, MABE_ID)
    expect(verbund.ok).toBe(true)
    if (!verbund.ok) return
    expect(verbund.ausCache).toBe(false)
    expect(verbund.ergebnis.unternehmen.ort).toBe('Daaden')
    expect(verbund.ergebnis.jahre.length).toBeGreaterThan(0)
    const mutter = verbund.ergebnis.beteiligungen.find((b) => b.name === 'Walter Henrich GmbH')
    expect(mutter?.richtung).toBe('aufwaerts')
    expect(mutter?.anteil_pct).toBe(100)
    expect(mutter?.quelle).toBe('openregister')

    // 4 · Zweiter Abruf kommt aus dem Cache (keine erneuten Credits)
    const gecacht = await openregisterVerbund(KLARTEXT, MABE_ID)
    expect(gecacht.ok).toBe(true)
    if (gecacht.ok) expect(gecacht.ausCache).toBe(true)

    // 4b · Kettenverfolgung: die Muttergesellschaft wurde rekursiv nachgeladen und gecacht
    const { rows: cacheRows } = await sql(
      "select company_id from openregister_cache where company_id like 'DE-HRB-T2214-%' order by company_id",
    )
    expect(cacheRows.map((r: { company_id: string }) => r.company_id)).toContain('DE-HRB-T2214-27640')

    // 5 · Audit-Eintrag vorhanden
    const { rows: audits } = await sql(
      "select aktion from audit_events where aktion = 'openregister_abfrage' and angebot_id = $1",
      [angebotId],
    )
    expect(audits.length).toBeGreaterThan(0)
  }, 60_000)
})
