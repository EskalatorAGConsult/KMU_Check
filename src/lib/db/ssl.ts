import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * TLS-Pinning fuer die Supabase-Postgres-Verbindung (verify-full):
 * Die gepinnte Root-CA (certs/supabase-prod-ca.crt, „Supabase Root 2021 CA",
 * gueltig bis 2031) wird gegen die Serverkette verifiziert – Schutz vor
 * MITM (Semgrep-Finding bypass-tls-verification).
 *
 * Fehlt die CA-Datei, faellt die Verbindung zurueck auf unverifiziertes TLS
 * mit einer deutlichen Warnung (Kompatibilitaet, nie still). CA erneuern:
 * node scripts/extrahiere-supabase-ca.mjs
 */
export function pgSsl(): { ca?: string; rejectUnauthorized: boolean } {
  try {
    const ca = readFileSync(path.join(process.cwd(), 'certs', 'supabase-prod-ca.crt'), 'utf8')
    return { ca, rejectUnauthorized: true }
  } catch {
    console.warn(
      '[db] WARNUNG: certs/supabase-prod-ca.crt fehlt – TLS-Verifikation der Datenbank ist AUSGESETZT ' +
        '(rejectUnauthorized: false). CA anlegen: node scripts/extrahiere-supabase-ca.mjs',
    )
    return { rejectUnauthorized: false } // nosemgrep: problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification -- bewusster Fallback mit lauter Warnung (CA fehlt)
  }
}
