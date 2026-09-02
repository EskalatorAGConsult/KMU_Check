// Live-Check des Resend-API-Tokens (KEIN Mail-Versand – nur Lese-Endpunkte).
// Verifiziert: 1) Token gültig (Auth gegen /domains), 2) verifizierte Domains,
// 3) passt die Absender-Domain aus EMAIL_FROM zu einer verifizierten Domain.
// Ausführen: node scripts/pruefe-resend.mjs
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const envWert = (name) =>
  env
    .split('\n')
    .find((l) => l.startsWith(`${name}=`))
    ?.split('=')[1]
    ?.replace(/["'\r]/g, '')

const key = envWert('RESEND_API_KEY')
if (!key) {
  console.error('✗ RESEND_API_KEY ist nicht gesetzt.')
  process.exit(1)
}
console.log(`• Token gefunden (${key.slice(0, 7)}…${key.slice(-4)})`)

const auth = { Authorization: `Bearer ${key}` }

// 1 · Token-Validität (read-only)
const res = await fetch('https://api.resend.com/domains', { headers: auth })
if (res.status === 401 || res.status === 403) {
  console.error(`✗ Token ungültig/abgelaufen (HTTP ${res.status}).`)
  process.exit(1)
}
if (!res.ok) {
  console.error(`✗ Unerwartete Antwort (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`)
  process.exit(1)
}
console.log('✓ Token gültig – Auth gegen api.resend.com erfolgreich.')

// 2 · Verifizierte Domains
const { data: domains } = (await res.json()) ?? {}
const verifiziert = (domains ?? []).filter((d) => d.status === 'verified').map((d) => d.name)
const andere = (domains ?? []).filter((d) => d.status !== 'verified').map((d) => `${d.name} (${d.status})`)
console.log(
  verifiziert.length > 0
    ? `✓ Verifizierte Absender-Domain(s): ${verifiziert.join(', ')}`
    : `⚠ Keine verifizierte Domain – Versand wäre nicht möglich.`,
)
if (andere.length > 0) console.log(`  · Unverifiziert: ${andere.join(', ')}`)

// 3 · Absender-Konfiguration gegen Domains prüfen
const from = envWert('EMAIL_FROM')
if (from) {
  const domain = from.split('@')[1]?.split('>')[0]
  const ok = verifiziert.includes(domain)
  console.log(
    ok
      ? `✓ EMAIL_FROM „${from}" passt zur verifizierten Domain.`
      : `✗ EMAIL_FROM „${from}" (Domain: ${domain ?? '?'}) ist NICHT verifiziert – Mails würden abgelehnt (403 from_address_unauthorized).`,
  )
} else {
  console.log('⚠ EMAIL_FROM nicht gesetzt – Fallback wäre no-reply@foerderportal.mabe.de.')
}

// 4 · Zustellbarkeit des Kontos (letzte Sends, read-only)
const sends = await fetch('https://api.resend.com/emails?limit=1', { headers: auth })
if (sends.ok) {
  const body = await sends.json()
  const n = body?.data?.length ?? 0
  console.log(n > 0 ? '✓ Versand-Historie vorhanden (Konto aktiv im Versand).' : 'ℹ Noch keine Sendung über dieses Konto (Testsendung fällig).')
} else {
  console.log(`ℹ Versand-Historie nicht abrufbar (HTTP ${sends.status}).`)
}
