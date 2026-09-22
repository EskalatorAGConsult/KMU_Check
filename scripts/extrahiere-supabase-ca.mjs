/**
 * Extrahiert die Root-CA der Supabase-Datenbank ueber den Postgres-SSL-
 * Handshake (SSLRequest -> 'S' -> TLS) und speichert sie nach
 * certs/supabase-prod-ca.crt (Zertifikats-Pinning, verify-full).
 *
 * Ausfuehren: node scripts/extrahiere-supabase-ca.mjs
 * Liest DATABASE_URL aus .env.local.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import tls from 'node:tls'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const url = new URL(process.env.DATABASE_URL)
const host = url.hostname
const port = Number(url.port || 5432)
console.log(`Verbinde mit ${host}:${port} (Postgres SSLRequest) …`)

const sock = net.connect(port, host, () => {
  // Postgres SSLRequest: 8 Bytes, Laenge 8, Magic-Code 80877103 (0x04d2162f)
  sock.write(Buffer.from([0, 0, 0, 8, 0x04, 0xd2, 0x16, 0x2f]))
})

sock.once('data', (antwort) => {
  if (antwort.toString('latin1') !== 'S') {
    console.error('Server lehnt SSL ab:', antwort.toString('latin1'))
    process.exit(1)
  }
  // rejectUnauthorized hier bewusst AUS: genau dieses Skript extrahiert die CA initial (Bootstrap).
  const tlsSock = tls.connect({ socket: sock, servername: host, rejectUnauthorized: false }, () => { // nosemgrep: problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification
    // Zertifikatskette bis zur Wurzel gehen
    let cert = tlsSock.getPeerCertificate(true)
    let wurzel = cert
    while (wurzel.issuerCertificate && Object.keys(wurzel.issuerCertificate).length > 0) {
      wurzel = wurzel.issuerCertificate
      if (wurzel.raw.equals(cert.raw)) break // Selbstsignatur-Schutz
      cert = wurzel
    }
    const pem =
      '-----BEGIN CERTIFICATE-----\n' +
      wurzel.raw.toString('base64').replace(/(.{64})/g, '$1\n') +
      '\n-----END CERTIFICATE-----\n'
    mkdirSync('certs', { recursive: true })
    writeFileSync('certs/supabase-prod-ca.crt', pem)
    console.log('Root-CA gespeichert: certs/supabase-prod-ca.crt')
    console.log(`Aussteller: ${JSON.stringify(wurzel.issuer)} | gueltig bis: ${wurzel.valid_to}`)
    tlsSock.end()
    process.exit(0)
  })
  tlsSock.once('error', (e) => {
    console.error('TLS-Fehler:', e.message)
    process.exit(1)
  })
})

sock.once('error', (e) => {
  console.error('Verbindungsfehler:', e.message)
  process.exit(1)
})
