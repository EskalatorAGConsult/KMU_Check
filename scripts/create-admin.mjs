/**
 * Legt ein Vertriebskonto an (erster Aufruf: Rolle 'admin').
 * Nutzung: node scripts/create-admin.mjs <email> [passwort]
 * Ohne Passwort wird eines generiert und EINMALIG ausgegeben.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { betterAuth } from 'better-auth'
import pg from 'pg'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const [email, passwortArg] = process.argv.slice(2)
if (!email) {
  console.error('Nutzung: node scripts/create-admin.mjs <email> [passwort]')
  process.exit(1)
}
const passwort = passwortArg ?? randomBytes(12).toString('base64url')

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  user: { additionalFields: { role: { type: 'string', defaultValue: 'vertrieb', input: false } } },
})

try {
  await auth.api.signUpEmail({ body: { email, password: passwort, name: email.split('@')[0] } })
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  if (!/exist|unique|duplicate/i.test(msg)) throw e
  console.log('Konto existiert bereits – Rolle wird sichergestellt.')
}

// Erstes Konto = admin
await pool.query(`update "user" set role = 'admin' where email = $1`, [email])
const { rows } = await pool.query(`select id, email, role from "user" where email = $1`, [email])
console.log('Angelegt/aktualisiert:', rows[0])
if (!passwortArg) console.log(`\nPasswort (einmalig, sicher notieren): ${passwort}\n`)
await pool.end()
