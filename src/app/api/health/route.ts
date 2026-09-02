import { NextResponse } from 'next/server'
import pg from 'pg'

/**
 * Ops-Healthcheck: meldet, welche serverseitigen Umgebungsvariablen gesetzt
 * sind (nur true/false, NIE Werte) und ob die Postgres-Verbindung
 * (DATABASE_URL) von dieser Laufzeit aus funktioniert.
 *
 * Hintergrund: Vercel kann keine IPv6-only-Hosts erreichen – steht dort der
 * Supabase-Direct-Host statt des Poolers in DATABASE_URL, liefern alle
 * DB-abhängigen Routen (/admin, /v/[token], /api/auth/*) HTTP 500.
 * Dieser Endpunkt macht das remote diagnostizierbar.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENV_NAMEN = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'NEXT_PUBLIC_APP_URL',
  'RESEND_API_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'OPENREGISTER_API_KEY',
  'GEMINI_API_KEY',
] as const

export async function GET() {
  const env = Object.fromEntries(ENV_NAMEN.map((n) => [n, !!process.env[n]]))
  // Blob-Token: Standardname ODER Store-praefixter Name (Store „MABE") zaehlt
  env.BLOB_READ_WRITE_TOKEN = !!(process.env.BLOB_READ_WRITE_TOKEN ?? process.env.MABE_READ_WRITE_TOKEN)
  // Resend-Key: Standardname ODER Alt-Name (RESEND_API in Vercel) zaehlt –
  // spiegelt resendClient() in src/lib/email/resend.ts.
  env.RESEND_API_KEY = !!(process.env.RESEND_API_KEY ?? process.env.RESEND_API)

  let datenbank = false
  let dbFehler: string | null = null
  if (env.DATABASE_URL) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 5000,
    })
    try {
      await pool.query('select 1')
      datenbank = true
    } catch (e) {
      dbFehler = (e instanceof Error ? e.message : String(e)).slice(0, 120)
    } finally {
      await pool.end().catch(() => undefined)
    }
  } else {
    dbFehler = 'DATABASE_URL ist nicht gesetzt'
  }

  const ok = datenbank && Object.values(env).every(Boolean)
  return NextResponse.json({ ok, datenbank, dbFehler, env }, { status: ok ? 200 : 503 })
}
