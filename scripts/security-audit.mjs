/**
 * SECURITY AUDIT — 10 Subagenten scannen den gesamten Codebase
 * gegen OWASP Top 10 + TypeScript-spezifische Schwachstellen.
 *
 * Agent 1:  SQL Injection
 * Agent 2:  Auth Bypass (Server Actions ohne Guard)
 * Agent 3:  XSS (dangerouslySetInnerHTML, eval)
 * Agent 4:  Sensitive Data Exposure (hardcoded Secrets)
 * Agent 5:  Open Redirect
 * Agent 6:  Path Traversal
 * Agent 7:  Insecure Crypto (MD5, SHA1, ECB)
 * Agent 8:  SSRF (fetch mit User-URL)
 * Agent 9:  Prototype Pollution / Unsafe JSON
 * Agent 10: Timing Attack / Insecure Comparison
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const SRC_DIR = 'src'
const findings = []
const scanned = { files: 0, lines: 0 }

function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === '_oatmeal_template') continue
      scan(full)
    } else if (['.ts', '.tsx'].includes(extname(full))) {
      const content = readFileSync(full, 'utf8')
      const lines = content.split('\n')
      scanned.files++
      scanned.lines += lines.length
      lines.forEach((line, i) => run(full, i + 1, line, content))
    }
  }
}

function add(agent, severity, rule, file, line, message, code) {
  findings.push({ agent, severity, rule, file, line, message, code: code.trim().slice(0, 120) })
}

function run(file, lineNum, line, fullContent) {
  const isServer = fullContent.includes("'use server'")
  const isServerOnly = fullContent.includes("'server-only'")
  const isAdminFile = file.includes('/admin/')
  const isAPIRoute = file.includes('/api/')

  // ═══ Agent 1: SQL Injection ═══
  if (/\.query\(|\.raw\(/.test(line) && /\$\{/.test(line) && /(?:select|insert|update|delete|where|from)/i.test(line)) {
    if (!/const\s+\w+\s*=|function|import|type|interface|comment|\/\//.test(line)) {
      add(1, 'ERROR', 'sql-injection', file, lineNum, 'Template-Literal mit Variable in SQL-Kontext', line)
    }
  }
  if (/\.query\(\s*`[^`]*\$\{/.test(line)) {
    add(1, 'ERROR', 'sql-string-interpolation', file, lineNum, 'SQL-Query mit Template-Interpolation', line)
  }

  // ═══ Agent 2: Auth Bypass ═══
  if (isServer && lineNum === 1 && !line.includes('*') && !line.includes('//')) {
    // Prüfe ob die Datei Guards enthält
    if (!fullContent.includes('requireAdmin') && !fullContent.includes('requireKunde') &&
        !fullContent.includes('validiereToken') && !fullContent.includes('fordereVorgangZugriff') &&
        !fullContent.includes('nehmeEinladungAn') && !fullContent.includes('oeffentlich')) {
      add(2, 'WARNING', 'server-action-no-guard', file, lineNum,
        "Server Action Datei ohne Auth-Guard (requireAdmin/requireKunde/validiereToken)", line)
    }
  }
  // API Route ohne Guard
  if (isAPIRoute && line.includes('export async function GET') || line.includes('export async function POST')) {
    const routeContent = fullContent
    if (!routeContent.includes('requireAdmin') && !routeContent.includes('requireKunde') &&
        !routeContent.includes('validiereToken') && !routeContent.includes('CRON_SECRET') &&
        !routeContent.includes('rateLimit') && !routeContent.includes('health')) {
      // Nur warnen wenn es keine bekannte öffentliche Route ist
      if (!file.includes('health') && !file.includes('lead') && !file.includes('auth')) {
        add(2, 'WARNING', 'api-route-no-guard', file, lineNum, 'API-Route ohne ersichtlichen Guard', line)
      }
    }
  }

  // ═══ Agent 3: XSS ═══
  if (/dangerouslySetInnerHTML/.test(line)) {
    add(3, 'ERROR', 'xss-dangerously-set', file, lineNum, 'dangerouslySetInnerHTML verwendet — XSS-Risiko', line)
  }
  if (/\beval\s*\(/.test(line) && !line.includes('//') && !line.includes('test')) {
    add(3, 'ERROR', 'xss-eval', file, lineNum, 'eval() aufgerufen — Code-Injection-Risiko', line)
  }
  if (/new Function\s*\(/.test(line) && !line.includes('//')) {
    add(3, 'ERROR', 'xss-new-function', file, lineNum, 'new Function() — Code-Injection-Risiko', line)
  }

  // ═══ Agent 4: Hardcoded Secrets ═══
  const secretPatterns = [
    { re: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{6,}['"]/i, msg: 'Hardcodiertes Passwort' },
    { re: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_-]{15,}['"]/i, msg: 'Hardcodierter API-Key' },
    { re: /(?:secret|token)\s*[:=]\s*['"][a-zA-Z0-9+/_-]{20,}['"]/i, msg: 'Hardcodierter Secret/Token' },
    { re: /sb_secret_[a-zA-Z0-9]+/, msg: 'Supabase Service-Role-Key im Code' },
    { re: /sk_live_[a-zA-Z0-9]+/, msg: 'Stripe Live-Key im Code' },
    { re: /re_[a-zA-Z0-9]{20,}/, msg: 'Resend API-Key im Code' },
    { re: /sbp_[a-zA-Z0-9]{20,}/, msg: 'Supabase Access Token im Code' },
  ]
  for (const { re, msg } of secretPatterns) {
    if (re.test(line) && !line.includes('process.env') && !line.includes('//') && !line.includes('test') && !line.includes('.env')) {
      add(4, 'ERROR', 'hardcoded-secret', file, lineNum, msg, line)
    }
  }

  // ═══ Agent 5: Open Redirect ═══
  if (/redirect\s*\(\s*(?!['"]\/|['"]#|['"]\/admin|['"]\/konto|['"]\/v\/)/.test(line) && /\$|\{/.test(line)) {
    add(5, 'WARNING', 'open-redirect', file, lineNum, 'Redirect mit potenziell unvalidiertem User-Input', line)
  }

  // ═══ Agent 6: Path Traversal ═══
  if (/(?:readFile|writeFile|readFileSync|writeFileSync|createReadStream)\s*\(\s*`[^`]*\$\{/.test(line)) {
    add(6, 'ERROR', 'path-traversal', file, lineNum, 'Dateioperation mit Template-Interpolation im Pfad', line)
  }
  if (/(?:readFile|readFileSync)\s*\(\s*(?:path\.)?join\s*\([^)]*\$\{/.test(line)) {
    add(6, 'WARNING', 'path-join-user-input', file, lineNum, 'path.join mit User-Input', line)
  }

  // ═══ Agent 7: Insecure Crypto ═══
  if (/createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/.test(line)) {
    add(7, 'ERROR', 'weak-hash', file, lineNum, 'Schwacher Hash-Algorithmus (MD5/SHA1)', line)
  }
  if (/['\"](?:aes-128-ecb|des3?|rc4|blowfish)['\"]|\.(?:createCipheriv|createDecipheriv)\s*\(\s*['\"](?:des|rc4)/i.test(line)) {
    add(7, 'ERROR', 'weak-cipher', file, lineNum, 'Schwacher Verschlüsselungsalgorithmus', line)
  }
  if (/Math\.random\s*\(\s*\)/.test(line) && /(?:token|secret|password|key|id|uuid)/i.test(line)) {
    add(7, 'WARNING', 'insecure-random', file, lineNum, 'Math.random() für sicherheitsrelevanten Wert', line)
  }

  // ═══ Agent 8: SSRF ═══
  const knownHosts = /(?:api\.supabase|generativelanguage|api\.openregister|api\.resend|hooks\.example|localhost|127\.0\.0\.1)/
  if (/fetch\s*\(\s*(?!['"`])/.test(line) && !knownHosts.test(line) && !line.includes('//') && !line.includes('test')) {
    if (/\$\{|\b(?:url|target|endpoint|dest|callback)\b/i.test(line)) {
      add(8, 'WARNING', 'ssrf-fetch', file, lineNum, 'fetch() mit potenziell unvalidierter URL', line)
    }
  }

  // ═══ Agent 9: Prototype Pollution ═══
  if (/JSON\.parse\s*\(\s*(?:req|request|body|input|data|raw|searchParams)/.test(line)) {
    add(9, 'WARNING', 'unsafe-json-parse', file, lineNum, 'JSON.parse mit User-Input ohne Schema-Validierung', line)
  }
  if (/Object\.assign\s*\(\s*\{\}\s*,\s*(?:req|request|body|input|data|parsed)/.test(line)) {
    add(9, 'WARNING', 'prototype-pollution', file, lineNum, 'Object.assign mit User-Input (Prototype Pollution)', line)
  }

  // ═══ Agent 10: Timing Attack ═══
  if (/(?:tokenHash|token_hash|passwordHash|hashedToken)\s*(?:===|!==)\s*/.test(line)) {
    add(10, 'WARNING', 'timing-attack-equals', file, lineNum, 'Direkter Vergleich von Hash-Werten (===) — Timing-Attack möglich', line)
  }
  if (/(?:crypto\.subtle\.timingSafeEqual|timingSafeEqual)/.test(line)) {
    // Das ist GUT — timingSafeEqual wird verwendet
    // Kein Finding, aber wir wissen dass der Code sicher ist
  }
}

// ═══ Scan ausführen ═══
scan(SRC_DIR)

// ═══ Ergebnisse ═══
console.log('╔════════════════════════════════════════════════════════════════╗')
console.log('║  SECURITY AUDIT — 10 Subagenten scannen gesamten Codebase     ║')
console.log('╚════════════════════════════════════════════════════════════════╝')
console.log(`  Gescannt: ${scanned.files} Dateien · ${scanned.lines.toLocaleString('de-DE')} Zeilen`)
console.log(`  Findings: ${findings.length}`)
console.log('')

const bySeverity = { ERROR: 0, WARNING: 0, INFO: 0 }
for (const f of findings) bySeverity[f.severity]++
console.log(`  🔴 ERROR:   ${bySeverity.ERROR}`)
console.log(`  🟡 WARNING: ${bySeverity.WARNING}`)
console.log('')

// Nach Agent gruppieren
const agents = new Map()
for (const f of findings) {
  if (!agents.has(f.agent)) agents.set(f.agent, [])
  agents.get(f.agent).push(f)
}

const agentNames = {
  1: 'SQL Injection', 2: 'Auth Bypass', 3: 'XSS', 4: 'Secrets',
  5: 'Open Redirect', 6: 'Path Traversal', 7: 'Insecure Crypto',
  8: 'SSRF', 9: 'Prototype Pollution', 10: 'Timing Attack',
}

console.log('── Findings je Subagent ──')
for (const [agent, items] of [...agents.entries()].sort((a, b) => a[0] - b[0])) {
  const icon = items.some(i => i.severity === 'ERROR') ? '🔴' : '🟡'
  console.log(`  ${icon} Agent ${agent} (${agentNames[agent]}): ${items.length} Findings`)
}
console.log('')

// ERROR-Findings im Detail
const errors = findings.filter(f => f.severity === 'ERROR')
if (errors.length > 0) {
  console.log('═══ ERROR-FINDINGS (SOFORT BEHEBEN) ═══')
  for (const f of errors) {
    console.log(`\n  🔴 [Agent ${f.agent}: ${agentNames[f.agent]}] ${f.rule}`)
    console.log(`     Datei: ${f.file}:${f.line}`)
    console.log(`     ${f.message}`)
    console.log(`     Code:  ${f.code}`)
  }
}

// WARNING-Findings zusammengefasst
const warnings = findings.filter(f => f.severity === 'WARNING')
if (warnings.length > 0) {
  console.log('\n═══ WARNING-FINDINGS (PRÜFEN) ═══')
  for (const f of warnings) {
    console.log(`  🟡 [Agent ${f.agent}] ${f.file}:${f.line} — ${f.message}`)
  }
}

console.log('\n═══ ZUSAMMENFASSUNG ═══')
console.log(`  Geprüft: OWASP Top 10 + TypeScript-spezifisch`)
console.log(`  Findings: ${findings.length} (${bySeverity.ERROR} ERROR, ${bySeverity.WARNING} WARNING)`)
console.log(`  Status: ${bySeverity.ERROR === 0 ? '✅ KEINE KRITISCHEN FINDINGS' : '❌ KRITISCHE FINDINGS VORHANDEN'}`)
