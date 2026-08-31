/**
 * Wendet das deklarative Schema aus supabase/schemas/ auf die Datenbank an.
 * Nutzung: node scripts/db-apply.mjs
 * Liest DATABASE_URL aus .env.local. Dateien werden in Namensreihenfolge
 * ausgefuehrt; *.disabled wird uebersprungen. Idempotent durch IF NOT EXISTS
 * bzw. create-or-replace nur dort, wo SQL es hergibt (Tabellen/Enums sind
 * bewusst NICHT idempotent – zweiter Lauf wirft einen klaren Fehler).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

// .env.local einlesen (ohne dotenv-Dependency)
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const dir = 'supabase/schemas'
const onlyPrefix = process.argv[2] // z. B. "07" -> nur Dateien mit diesem Prefix
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .filter((f) => (onlyPrefix ? f.startsWith(onlyPrefix) : true))
  .sort()

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
for (const f of files) {
  const sql = readFileSync(join(dir, f), 'utf8')
  process.stdout.write(`→ ${f} ... `)
  try {
    await client.query(sql)
    console.log('ok')
  } catch (err) {
    console.log(`FEHLER: ${err.message}`)
    await client.end()
    process.exit(1)
  }
}
await client.end()
console.log('Schema vollständig angewendet.')
