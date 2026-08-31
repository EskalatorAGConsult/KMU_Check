/**
 * Verifiziert das Schema gegen die Datenbank (CHECK-Phase):
 *  1. Tabellen + RLS-Status
 *  2. FK-Spalten ohne Index (Advisor-Check)
 *  3. Constraint-Verhalten (positive + negative Fälle, in Transaktion mit Rollback)
 *  4. updated_at-Trigger
 *  5. Rechte: anon/authenticated duerfen nichts lesen
 *  6. digest() fuer Token-Hashing vorhanden
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

let failures = 0
const ok = (name, pass, detail = '') => {
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!pass) failures++
}

// 1 · Tabellen + RLS
const EXPECTED = [
  'angebote', 'journey_tokens', 'journey_fortschritt', 'stammdaten', 'beteiligungen',
  'kmu_bewertungen', 'deminimis_beihilfen', 'deminimis_erklaerungen', 'vollmachten',
  'dokumente', 'uebergaben', 'audit_events', 'einstellungen', 'benutzer_einladungen',
]
const { rows: tables } = await client.query(
  `select relname, relrowsecurity from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r' and relname = any($1)
   order by relname`,
  [EXPECTED],
)
ok('Alle 14 Tabellen vorhanden', tables.length === 14, `${tables.length}/14`)
const noRls = tables.filter((t) => !t.relrowsecurity).map((t) => t.relname)
ok('RLS auf allen Tabellen aktiv', noRls.length === 0, noRls.join(',') || 'alle')

// 2 · FK ohne Index
const { rows: missingIdx } = await client.query(`
  select conrelid::regclass::text as tabelle, a.attname as spalte
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid and a.attnum = any(i.indkey::int[])
    )
  order by 1`)
ok('Jeder FK hat einen Index', missingIdx.length === 0,
  missingIdx.map((r) => `${r.tabelle}.${r.spalte}`).join(', ') || 'alle indiziert')

// 2b · UUIDv7 (RFC 9562): Funktion liefert Version 7, zeit-sortiert, Defaults gesetzt
const { rows: [uv] } = await client.query(
  `with a as (select uuid_v7() as u, pg_sleep(0.02)), b as (select uuid_v7() as u2 from a)
   select (select u from a)::text as u1, ((select u from a) < (select u2 from b)) as monoton`)
ok('uuid_v7() liefert UUID Version 7', uv.u1.charAt(14) === '7', uv.u1)
ok('uuid_v7() ist zeit-sortiert (Monotonie ueber ms-Grenze)', uv.monoton === true)
const { rows: [ud] } = await client.query(
  `select count(*)::int as n from pg_attrdef where pg_get_expr(adbin, adrelid) like '%uuid_v7%'`)
ok('uuid_v7-Default auf allen 9 ID-Spalten', ud.n === 9, `${ud.n}/9`)

// 3 · Constraint-Verhalten (Transaktion + Rollback)
await client.query('begin')
// Seit Migration 09 verweist angebote.angelegt_von auf die Better-Auth-"user"-Tabelle
// (text-id) – der Smoke-Test legt deshalb einen Dummy-User im Rollback-Scope an.
const admin = 'verify-smoke-admin'
await client.query(
  `insert into "user" ("id", "name", "email", "emailVerified", "role") values ($1, 'Verify Smoke', 'verify-smoke@example.invalid', true, 'admin')`,
  [admin])
const ins = (sql, params) => client.query(sql, params)
let spCounter = 0
const expectError = async (name, fn, mustMatch) => {
  // Postgres bricht nach einem Fehler die ganze Transaktion ab (25P02) –
  // jeder Negativtest laeuft deshalb in einem eigenen Savepoint.
  const sp = `sp_${++spCounter}`
  await client.query(`savepoint ${sp}`)
  try {
    await fn()
    ok(name, false, 'kein Fehler geworfen (Constraint greift nicht!)')
    await client.query(`release savepoint ${sp}`)
  } catch (e) {
    await client.query(`rollback to savepoint ${sp}`)
    ok(name, mustMatch.test(e.message), e.message.split('\n')[0])
  }
}

// Positivfall: kompletter Vorgang
const { rows: [ag] } = await ins(
  `insert into angebote (angelegt_von, kunde_firma, kunde_email, angebot_nr, angebot_datum,
     technologien, sensoren_gesamt, sensoren_prozessbezug)
   values ($1, 'Test GmbH', 'kunde@test.de', 'ANG-2026-001', current_date,
     array['messtechnik']::technologie[], 12, 5) returning id`,
  [admin])
ok('Positiv: Angebot anlegbar', !!ag?.id)

await ins(
  `insert into journey_tokens (angebot_id, token_hash, expires_at)
   values ($1, digest('test-token-123', 'sha256'), now() + interval '90 days')`,
  [ag.id])
ok('Positiv: Token mit SHA-256-Hash anlegbar (digest verfuegbar)', true)

await ins(
  `insert into stammdaten (angebot_id, unternehmensname, plz, ort, strasse, email, wz_code,
     unternehmensart, vorsteuerabzug, personenart, steuernummer, gruppenzugehoerigkeit,
     wirtschaftlich_taetig, iban)
   values ($1, 'Test GmbH', '08060', 'Zwickau', 'Marienthaler Str. 14', 'info@test.de', '28.29',
     'eigenstaendig', true, 'juristisch', '123/456/78901', 'privat', true,
     'DE02120300000000202051')`,
  [ag.id])
ok('Positiv: Stammdaten (juristische Person) anlegbar', true)

await ins(
  `insert into beteiligungen (angebot_id, name, richtung, anteil_pct) values ($1, 'Mutter AG', 'aufwaerts', 60)`,
  [ag.id])
ok('Positiv: Beteiligung (60 %) anlegbar', true)

await ins(
  `insert into kmu_bewertungen (angebot_id, geschaeftsjahr, abgeschlossen, kategorie, foerderquote_pct)
   values ($1, 2025, true, 'klein', 45)`,
  [ag.id])
ok('Positiv: KMU-Bewertung (Quote 45) anlegbar', true)

// Negativfaelle
await expectError(
  'Negativ: Beteiligung 20 % abgelehnt (< 25 % wird fachlich ignoriert)',
  () => ins(`insert into beteiligungen (angebot_id, name, richtung, anteil_pct) values ($1, 'X', 'abwaerts', 20)`, [ag.id]),
  /anteil_pct|check/i)
await expectError(
  'Negativ: Förderquote 30 % abgelehnt (nur 25/35/45 erlaubt)',
  () => ins(`insert into kmu_bewertungen (angebot_id, geschaeftsjahr, abgeschlossen, foerderquote_pct) values ($1, 2024, true, 30)`, [ag.id]),
  /foerderquote|check/i)
await expectError(
  'Negativ: Token-Hash mit falscher Länge abgelehnt (!= 32 Bytes)',
  () => ins(`insert into journey_tokens (angebot_id, token_hash, expires_at) values ($1, '\\x0102'::bytea, now() + interval '1 day')`, [ag.id]),
  /token_hash|check/i)
await expectError(
  'Negativ: Ungültige PLZ abgelehnt',
  () => ins(`update stammdaten set plz = '1234' where angebot_id = $1`, [ag.id]),
  /plz|check/i)
await expectError(
  'Negativ: Juristische Person ohne Steuernummer abgelehnt',
  () => ins(
    `insert into stammdaten (angebot_id, unternehmensname, plz, ort, strasse, email, wz_code,
       unternehmensart, vorsteuerabzug, personenart, gruppenzugehoerigkeit, wirtschaftlich_taetig)
     values ($1, 'Ohne Steuernr GmbH', '08060', 'Zwickau', 'Str. 1', 'a@b.de', '28.29',
       'eigenstaendig', true, 'juristisch', 'privat', true)`,
    ['00000000-0000-0000-0000-000000000002']),
  /personenart|check/i)

// 4 · updated_at-Trigger
// Hinweis: now() ist transaktionskonstant – ein Zeitvergleich innerhalb derselben
// Transaktion beweist nichts. Beweis stattdessen: updated_at manuell auf die
// Vergangenheit setzen, dann ein Feld aendern; der Trigger muss es ueberschreiben.
await ins(`update angebote set updated_at = '2020-01-01'::timestamptz where id = $1`, [ag.id])
await ins(`update angebote set notiz = 'trigger-test' where id = $1`, [ag.id])
const { rows: [after] } = await ins('select updated_at, notiz from angebote where id = $1', [ag.id])
ok('updated_at-Trigger überschreibt den Zeitstempel bei UPDATE',
  new Date(after.updated_at).getFullYear() >= 2026 && after.notiz === 'trigger-test',
  `updated_at = ${after.updated_at.toISOString()}`)

await client.query('rollback')
ok('Testdaten vollständig zurückgerollt (DB sauber)', true)

// 5 · Rechte: anon/authenticated duerfen nichts
for (const role of ['anon', 'authenticated']) {
  await client.query('begin')
  await client.query(`set local role ${role}`)
  await expectError(
    `Rechte: Rolle '${role}' kann angebote nicht lesen`,
    () => client.query('select * from angebote limit 1'),
    /permission denied/i)
  await expectError(
    `Rechte: Rolle '${role}' kann einstellungen nicht lesen`,
    () => client.query('select * from einstellungen limit 1'),
    /permission denied/i)
  await client.query('rollback')
}

await client.end()
console.log(failures === 0 ? '\nALLE CHECKS BESTANDEN' : `\n${failures} CHECK(S) FEHLGESCHLAGEN`)
process.exit(failures === 0 ? 0 : 1)
