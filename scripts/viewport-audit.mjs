/**
 * Viewport-/Responsivitäts-Audit (manuell, kein dauerhafter Bestandteil):
 * prueft horizontale Overflows und macht Screenshots ueber die Kernseiten
 * und gaengige Viewports (iPhone, Android, Tablet, Laptop, 16:9, 21:9).
 *
 * Ausfuehren: npm run dev -- --port 3100  (parallel)  &&  node scripts/viewport-audit.mjs
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASIS = process.env.AUDIT_URL ?? 'http://localhost:3100'
const TOKEN = process.env.AUDIT_TOKEN // Journey-Token (optional, fuer /v/…)
const CHROME =
  process.env.CHROME_PATH ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`

const VIEWPORTS = [
  { name: 'iphone-390', width: 390, height: 844 },
  { name: 'android-360', width: 360, height: 740 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'wide-1920', width: 1920, height: 1080 },
  { name: 'ultrawide-3440', width: 3440, height: 1440 },
]

const SEITEN = [
  { pfad: '/', name: 'landing' },
  { pfad: '/admin/login', name: 'admin-login' },
  ...(TOKEN ? [{ pfad: `/v/${TOKEN}`, name: 'journey' }] : []),
]

mkdirSync('/tmp/viewport-audit', { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME })
let probleme = 0

for (const seite of SEITEN) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    await page.goto(`${BASIS}${seite.pfad}`, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => {})
    await page.waitForTimeout(1200)

    // Horizontaler Overflow + die breitesten Uebertreter
    const befund = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      const overflow = document.documentElement.scrollWidth - vw
      const breit = []
      if (overflow > 1) {
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect()
          if (r.right > vw + 1 || r.left < -1) {
            breit.push(`${el.tagName}.${String(el.className).slice(0, 60)} [${Math.round(r.left)}..${Math.round(r.right)}]`)
          }
          if (breit.length >= 5) break
        }
      }
      return { vw, scrollWidth: document.documentElement.scrollWidth, overflow, breit }
    })

    const status = befund.overflow > 1 ? '❌ OVERFLOW' : '✓'
    if (befund.overflow > 1) probleme++
    console.log(`${status} ${seite.name} @ ${vp.name}: scrollWidth=${befund.scrollWidth} vw=${befund.vw}`)
    for (const b of befund.breit) console.log(`      ↳ ${b}`)

    await page.screenshot({ path: `/tmp/viewport-audit/${seite.name}-${vp.name}.png`, fullPage: false })
    await page.close()
  }
}

await browser.close()
console.log(probleme === 0 ? '\nALLE VIEWPORTS SAUBER' : `\n${probleme} VIEWPORT(S) MIT OVERFLOW`)
process.exit(probleme === 0 ? 0 : 1)
