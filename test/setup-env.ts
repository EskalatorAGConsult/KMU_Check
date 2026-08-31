/**
 * Vitest-Setup: laedt .env.local VOR allen Testmodulen (ES-Imports hoisten –
 * ein Laden im Testmodul selbst kaeme zu spaet, siehe Verifikations-Befund:
 * better-auth baute sonst den pg-Pool mit leerer DATABASE_URL = localhost).
 */
import { readFileSync } from 'node:fs'

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {
  // keine .env.local vorhanden (CI) – Integrationstests werden dann uebersprungen
}
