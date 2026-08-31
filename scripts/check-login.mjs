/**
 * Verifiziert ein Login (E-Mail + Passwort) gegen Better Auth und prueft
 * die Rolle. Legt keine dauerhaften Daten an (Test-Session wird aufgeraeumt).
 * Nutzung: node scripts/check-login.mjs <email> <passwort>
 */
import { readFileSync } from 'node:fs'
import { betterAuth } from 'better-auth'
import pg from 'pg'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const [email, passwort] = process.argv.slice(2)
if (!email || !passwort) {
  console.error('Nutzung: node scripts/check-login.mjs <email> <passwort>')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  user: { additionalFields: { role: { type: 'string', defaultValue: 'vertrieb', input: false } } },
})

const { rows } = await pool.query(`select id, email, role, "emailVerified" from "user" where email = $1`, [email])
if (!rows[0]) {
  console.error(`FEHLER: Kein Konto mit E-Mail ${email} gefunden.`)
  process.exit(1)
}
console.log(`Konto gefunden: ${rows[0].email} · Rolle: ${rows[0].role} · E-Mail verifiziert: ${rows[0].emailVerified}`)

try {
  const res = await auth.api.signInEmail({ body: { email, password: passwort } })
  console.log('PASSWORT OK – Login wuerde funktionieren.')
  // Test-Session wieder aufraeumen
  if (res?.token) await pool.query('delete from session where token = $1', [res.token])
} catch (e) {
  console.error(`PASSWORT FALSCH oder Login blockiert: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
}
await pool.end()
