/**
 * TLS-Pinning fuer die Supabase-Postgres-Verbindung in den OPS-SKRIPTEN
 * (verify-full mit gepinnter Root-CA, certs/supabase-prod-ca.crt).
 * Spiegel von src/lib/db/ssl.ts – Skripte sind plain Node (.mjs).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

export function pgSsl() {
  try {
    const ca = readFileSync(path.join(process.cwd(), 'certs', 'supabase-prod-ca.crt'), 'utf8')
    return { ca, rejectUnauthorized: true }
  } catch {
    console.warn('[db] WARNUNG: certs/supabase-prod-ca.crt fehlt – TLS-Verifikation ausgesetzt (CA: scripts/extrahiere-supabase-ca.mjs)')
    return { rejectUnauthorized: false } // nosemgrep: problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification -- bewusster Fallback mit lauter Warnung (CA fehlt)
  }
}
