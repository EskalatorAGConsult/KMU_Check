/**
 * E2E-Klickdurchlauf der kompletten Journey (manuell, kein Testbestandteil):
 * oeffnet einen echten Journey-Link, fuellt jeden Schritt aus, misst auf dem
 * iPhone-Viewport (390) horizontale Overflows und reicht am Ende mit einer
 * hochgeladenen Vollmacht ein. Beweist damit Bedienbarkeit + Datenfluss.
 *
 * Ausfuehren: npm run dev -- --port 3100 (parallel) &&
 *             AUDIT_TOKEN=<token> node scripts/e2e-journey.mjs
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASIS = process.env.AUDIT_URL ?? 'http://localhost:3100'
const TOKEN = process.env.AUDIT_TOKEN
if (!TOKEN) {
  console.error('AUDIT_TOKEN fehlt')
  process.exit(1)
}
const CHROME =
  process.env.CHROME_PATH ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`

mkdirSync('/tmp/viewport-audit', { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME })
const vpBreite = Number(process.env.VP_BREITE ?? 390)
const vpHoehe = Number(process.env.VP_HOEHE ?? 844)
const page = await browser.newPage({ viewport: { width: vpBreite, height: vpHoehe } })

let schrittNr = 0
async function checkpoint(name) {
  schrittNr++
  await page.waitForTimeout(900)
  const befund = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    return { overflow: document.documentElement.scrollWidth - vw }
  })
  const status = befund.overflow > 1 ? `❌ OVERFLOW (${befund.overflow}px)` : '✓'
  console.log(`${status} Schritt ${schrittNr}: ${name}`)
  await page.screenshot({ path: `/tmp/viewport-audit/e2e-${String(schrittNr).padStart(2, '0')}-${name}.png` })
  if (befund.overflow > 1) process.exitCode = 1
}

async function weiter() {
  await page.getByRole('button', { name: /^Weiter:/ }).click()
  await page.waitForTimeout(700)
}

// 0 · Übersicht (Consent-Banner zuerst beantworten – DSGVO-Pflichtwand)
await page.goto(`${BASIS}/v/${TOKEN}`, { waitUntil: 'networkidle', timeout: 45_000 })
const banner = page.getByRole('button', { name: 'Nur erforderliche' }).first()
if (await banner.isVisible().catch(() => false)) await banner.click()
await checkpoint('uebersicht')
await weiter()

// 1 · Unternehmen
await page.locator('#f-unternehmensname').fill('E2E-Test GmbH')
await page.locator('#f-land').selectOption('Deutschland')
await page.locator('#f-plz').fill('45468')
await page.locator('#f-ort').fill('Mülheim an der Ruhr')
await page.locator('#f-strasse').fill('Werkstraße 3')
await page.locator('#f-email').fill('kunde@test.de')
await page.locator('#f-wz_code').fill('28.29')
await page.locator('#f-unternehmensart').selectOption('eigenstaendig')
await page.locator('#f-personenart').selectOption('juristisch')
await page.locator('#f-steuernummer').fill('123/456/78901')
await checkpoint('unternehmen')
await weiter()

// 2 · Ansprechpartner
await page.locator('#f-ap_rolle').fill('Geschäftsführung')
await page.locator('#f-ap_anrede').selectOption('Herr')
await page.locator('#f-ap_vorname').fill('Max')
await page.locator('#f-ap_nachname').fill('Mustermann')
await page.locator('#f-ap_email').fill('kunde@test.de')
await checkpoint('ansprechpartner')
await weiter()

// 3 · KMU: beide Geschaeftsjahre fuellen (JAE/Umsatz/Bilanz je fieldset) + „Nein" zum Verbund
const fieldsets = page.locator('fieldset')
for (const i of [0, 1]) {
  const fs = fieldsets.nth(i)
  await fs.locator('input[type=number]').nth(0).fill('12') // JAE
  await fs.locator('input[type=number]').nth(1).fill('3500000') // Umsatz
  await fs.locator('input[type=number]').nth(2).fill('1800000') // Bilanzsumme
}
await page.getByRole('button', { name: 'Nein', exact: true }).click() // keine Beteiligungen
await checkpoint('kmu')
await weiter()

// 4 · De-minimis: Liste leer lassen, Pflicht-Checkbox bestaetigen
await page.getByRole('checkbox', { name: /subventionserheblich/ }).click()
await checkpoint('deminimis')
await weiter()

// 5 · Antrag & Bank (Defaults vorbefuellt: privat/ja)
await page.locator('#f-wirtschaftlich_taetig').selectOption('ja')
await page.locator('#f-kontoinhaber').fill('E2E-Test GmbH')
await page.locator('#f-iban').fill('DE89370400440532013000')
await checkpoint('antrag')
await weiter()

// 6 · Vollmacht: Upload-Weg (BAFA-Vorlage als unterschriebene Datei simuliert)
await page.locator('input[type=file]').setInputFiles('docs/vorlagen/eew_formular_eew_vm_3.pdf')
await page.getByText('Signierte Vollmacht hochgeladen').waitFor({ timeout: 30_000 })
await checkpoint('vollmacht-upload')

await page.getByRole('checkbox', { name: /Vorhabenbeginn/ }).click()
await page.getByRole('checkbox', { name: /alle Angaben in diesem Vorgang/ }).click()
await page.getByRole('checkbox', { name: /Datenschutz:/ }).click()
await checkpoint('vollmacht-bestaetigungen')

await page.getByRole('button', { name: /Verbindlich absenden/ }).click()
await page.getByText(/Geschafft/).waitFor({ timeout: 45_000 })
await checkpoint('erfolg')

console.log(process.exitCode ? '\nE2E MIT OVERFLOW-BEFUNDEN' : '\nE2E KOMPLETT: Journey eingereicht, keine Overflows')
await browser.close()
