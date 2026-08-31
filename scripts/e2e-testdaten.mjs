/**
 * E2E-Testdaten: legt ein Test-Angebot + Journey-Token an (Rolle des
 * Admin-Flows simulierend) und gibt den Link aus.
 * Nutzung: node scripts/e2e-testdaten.mjs
 */
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import pg from 'pg'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const { rows: [u] } = await c.query('select id from "user" limit 1')
const { rows: [a] } = await c.query(
  `insert into angebote (angelegt_von, status, kunde_firma, kunde_email, angebot_nr, angebot_datum, technologien, sensoren_gesamt, sensoren_prozessbezug, invest_messtechnik)
   values ($1, 'eingeladen', 'E2E-Test GmbH', 'kunde@test.de', 'ANG-E2E-001', current_date, array['messtechnik']::technologie[], 12, 5, 48000)
   returning id`,
  [u.id],
)
const token = `testreise-${randomBytes(12).toString('base64url')}`
const hash = createHash('sha256').update(token, 'utf8').digest()
await c.query(
  `insert into journey_tokens (angebot_id, token_hash, expires_at) values ($1, $2, now() + interval '90 days')`,
  [a.id, hash],
)
console.log(`LINK=/v/${token}`)
console.log(`ANGEBOT_ID=${a.id}`)
await c.end()
