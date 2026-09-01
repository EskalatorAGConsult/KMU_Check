// Live-Check der Vercel-Blob-Verbindung im PRIVATE-Modus mit dem Token aus
// der Environment (.env.local bzw. CI-Env). Verifiziert die volle Kette:
//   1. Verbindung + Auth (list)
//   2. Upload access:'private' (put)
//   3. Direktaufruf OHNE Token muss scheitern (Beweis: wirklich privat)
//   4. Autorisierter Lesezugriff (get mit Token) liefert die Bytes
//   5. Aufraeumen (del)
// Ausführen: node scripts/pruefe-blob-private.mjs
import { del, get, list, put } from '@vercel/blob'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const envWert = (name) =>
  env
    .split('\n')
    .find((l) => l.startsWith(`${name}=`))
    ?.split('=')[1]
    ?.replace(/["'\r]/g, '')

const token = envWert('BLOB_READ_WRITE_TOKEN') ?? envWert('MABE_READ_WRITE_TOKEN')
if (!token) {
  console.error('✗ Weder BLOB_READ_WRITE_TOKEN noch MABE_READ_WRITE_TOKEN sind gesetzt.')
  process.exit(1)
}
const herkunft = envWert('BLOB_READ_WRITE_TOKEN') ? 'BLOB_READ_WRITE_TOKEN' : 'MABE_READ_WRITE_TOKEN'
console.log(`• Token gefunden über ${herkunft} (${token.slice(0, 8)}…${token.slice(-4)})`)

const PREFIX = '_verbindungstest/'
let fehlgeschlagen = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`)
  if (!ok) fehlgeschlagen++
}

// 1 · Verbindung + Authentifizierung
let verbunden = false
try {
  await list({ prefix: PREFIX, token, limit: 1 })
  verbunden = true
} catch (e) {
  check('Verbindung/Auth (list)', false, e.message)
}
if (verbunden) check('Verbindung/Auth (list)', true)

// 2 · Upload im Private-Modus
let url = null
if (verbunden) {
  try {
    const blob = await put(`${PREFIX}probe.txt`, 'private-verbindingstest', {
      access: 'private',
      token,
      addRandomSuffix: true,
      contentType: 'text/plain',
    })
    url = blob.url
    check("Upload access:'private' (put)", true, url.split('/').pop())
  } catch (e) {
    check("Upload access:'private' (put)", false, e.message)
  }
}

// 3 · Direktaufruf ohne Token MUSS scheitern (Store wirklich privat?)
if (url) {
  try {
    const res = await fetch(url)
    // 2xx/3xx = oeffentlich abrufbar -> der Store ist NICHT privat
    check('Direktaufruf ohne Token abgelehnt', !res.ok, `HTTP ${res.status}`)
  } catch (e) {
    check('Direktaufruf ohne Token abgelehnt', true, `Netzwerkfehler wie erwartet (${e.message})`)
  }
}

// 4 · Autorisiertes Lesen mit Token
if (url) {
  try {
    const res = await get(url, { access: 'private', token })
    const text = await new Response(res.stream).text()
    check('Lesen mit Token (get)', text === 'private-verbindingstest', `${text.slice(0, 30)} (${res.headers.get('content-type')})`)
  } catch (e) {
    check('Lesen mit Token (get)', false, e.message)
  }
}

// 5 · Aufraeumen
if (url) {
  try {
    await del(url, { token })
    check('Aufräumen (del)', true)
  } catch (e) {
    check('Aufräumen (del)', false, e.message)
  }
}

console.log(fehlgeschlagen === 0 ? '\nPASS: Private Blob-Verbindung vollständig verifiziert.' : `\nFAIL: ${fehlgeschlagen} Check(s) fehlgeschlagen.`)
process.exit(fehlgeschlagen === 0 ? 0 : 1)
