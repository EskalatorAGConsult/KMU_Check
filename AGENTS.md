# AGENTS.md – MABE KMU-Fördercheck

Hinweise für KI-Coding-Agents, die an diesem Projekt arbeiten.

## Projektüberblick

Interaktive, mehrstufige Landingpage für die **MABE Maschinen- und Behälterbau GmbH**.
Besucher prüfen live, ob ihr Unternehmen als **KMU nach EU-Empfehlung 2003/361/EG** gilt
und welche **Förderquote im BAFA-Programm Modul 3** (45 % / 35 % / 25 %) möglich ist –
inklusive Verbund-Verrechnung (Partner-/verbundene Unternehmen), clientseitigem
PDF-Nachweis (jsPDF) und serverseitiger Lead-Übergabe an einen Webhook.

Basis ist das **Tailwind-Plus-„Oatmeal“-Template** (Next.js 16, React 19, Tailwind CSS v4),
re-skinnt auf die MABE-CI (Navy + Türkis, erzwungener White-Mode, WCAG-konforme Kontraste).

Dazu das **Förderportal** (Vercel + Supabase Postgres):
- **Kunden-Journey `/v/[token]`** – token-geschützte Klickstrecke (Stammdaten → KMU-Status →
  De-minimis → Antrag/Bank → Vollmacht), am Ende automatische Systemkonzept-PDF (pdf-lib,
  Vercel Blob) und Übergabe an den Webhook.
- **Admin `/admin`** – Vorgänge, Angebot-Anlage (PDF-Extraktion via Gemini), Kunden- und
  Benutzerverwaltung, Einstellungen (Webhook-URL in DB mit ENV-Fallback).
- **Kundenkonto `/konto`** – öffentliche Registrierung (Better-Auth-Rolle `kunde`), Dashboard
  mit Status und Dossier-PDF-Download.
Gesamtkonzept: `docs/PLAN-foerderportal.md`.

Die Projektsprache ist **Deutsch**: UI-Texte, Code-Kommentare, Doku und Commit-Kontext
werden auf Deutsch verfasst. Einige Kommentare in den Oatmeal-Template-Komponenten sind
noch englisch (Template-Ursprung) – das ist so gewollt und muss nicht geändert werden.

## Technologie-Stack

- **Next.js 16** (App Router) + **React 19**, TypeScript (strict)
- **Tailwind CSS v4** (CSS-first via `@import 'tailwindcss'` + `@theme` in
  `src/app/globals.css`, kein `tailwind.config`)
- `@tailwindplus/elements` (Tailwind-Plus-UI-Primitives), `clsx`
- `jspdf` für den clientseitigen PDF-Nachweis (dynamischer Import in `src/lib/pdf.ts`),
  `pdf-lib` für serverseitige PDFs (Systemkonzept, Fallakte, Dossier, BAFA-Vollmacht)
- `@fingerprintjs/fingerprintjs` für die Visitor-ID im Tracking
- **Supabase** (Postgres 17, EU): `pg` als direkter DB-Treiber (Repositories + Better-Auth),
  `@supabase/supabase-js`/`@supabase/ssr` für den Service-Role-Client (`src/lib/db/server.ts`)
- **Better Auth** (`src/lib/auth/`): E-Mail+Passwort (min. 12 Zeichen, 8-h-Session), Rollen
  `admin` | `eskalator` | `vertrieb` (gleiche Admin-Rechte) | `kunde` | `deaktiviert`;
  Rolle kommt nie aus dem Client (`input: false`)
- **Resend** (`src/lib/email/`): best effort – Mail-Ausfall blockiert nie den Fachprozess
- **Vercel Blob** (`src/lib/storage/blob.ts`): privater Storage für Dokumente
- **Gemini API** (serverseitig): Extraktion der Angebots-PDFs (`GEMINI_API_KEY`)
- **openregister.de API** (serverseitig): Unternehmens-/Verbunddaten
  (`OPENREGISTER_API_KEY`, Bearer-Auth, Geldwerte in **Cents**, 30-Tage-Cache in `openregister_cache`)
- **T3 Env** (`src/env.ts`, `@t3-oss/env-core`): zentrale, schema-validierte
  ENV-Zugriffsstelle – direkte `process.env`-Zugriffe sind außerhalb dieser
  Datei verboten; alle Variablen formatvalidiert, aber bewusst **optional**
  (Best-Effort-Muster + `/api/health`). Live-Proxy, damit die Testsuite
  weiter mit `vi.stubEnv` arbeitet.
- **MSW v2** (Test-Setup `test/msw-server.ts`): HTTP-Mocks auf Node-Fetch-
  Ebene – Netzwerkgrenzen (OpenRegister, Gemini, Resend, Lead-Webhook)
  werden deterministisch getestet, ohne echte Credits/Keys zu verbrauchen.
- Deployment: **Vercel** (`vercel.json` setzt nur `"framework": "nextjs"`)

## Build- und Test-Kommandos

```bash
npm install        # Abhängigkeiten installieren
npm run dev        # Dev-Server auf http://localhost:3000
npm run build      # Produktions-Build
npm start          # Produktions-Server
npm run lint       # ESLint (eslint-config-next, Flat Config)
```

- **Test-Suite: Vitest (`npm test`)** – ~220 Unit-Tests in `*.test.ts` neben dem Code
  (KMU-Engine gegen EU-Schwellenwerte, Webhook-Auflösung, PDF-Generatoren, Journey-Schemas,
  OpenRegister-Mapping, Security …). Verifikation im Alltag: `npm test` + `npm run lint`
  + `npm run build`.
- **Integrations-/Live-Tests** sind bewusst ENV-abhängig und schlagen ohne Credentials lokal
  fehl (erwartbar): `*.integration.test.ts` + `fallakte-live.test.ts` brauchen `DATABASE_URL`
  bzw. Supabase-ENV; OpenRegister-Live-Test nur mit `RUN_LIVE_TESTS=1` (kostet echte Credits).
  Netzwerkgrenzen in Unit-Tests über MSW-Handler abfangen (`server.use()`), nie echte
  Endpunkte aufrufen.
- Bei Änderungen an `src/lib/kmu.ts` die Schwellenwerte zusätzlich gegen die in `README.md`
  verlinkten EU-Quellen verifizieren. Nach jeder Schema-Änderung: `npm test` **und**
  `scripts/db-verify.mjs` laufen lassen.

## Projektstruktur

```
src/
  app/
    layout.tsx            Root-Layout: Navbar, Footer, Fonts, Metadata (de)
    page.tsx              Landingpage (Hero + eingebetteter KMU-Check + Sektionen)
    globals.css           Tailwind-v4-Theme: MABE-Farbtokens (mabe, teal, olive),
                          erzwungener White-Mode, Fokus-/iOS-/Motion-Regeln
    api/lead/route.ts     POST-Route: Lead-Annahme + serverseitige Webhook-
                          Weiterleitung (Node-Runtime, WEBHOOK_URL)
    api/health/route.ts   Ops-Healthcheck: ENV gesetzt? (true/false) + DB-Ping –
                          diagnostiziert u. a. die IPv6/Pooler-Falle remote
    api/auth/[...all]/    Better-Auth-Handler (alle Auth-Routen)
    admin/                Portal für Vertrieb: Vorgänge, Angebot-Anlage (Gemini-
                          Extraktion), Kunden (/admin/kunden), Benutzer (/admin/
                          benutzer, Einladungslinks), Einstellungen (Webhook-URL
                          in DB, ENV-Fallback); PDF-/CSV-Routen; Guard: requireAdmin
    v/[token]/            Kunden-Journey (Wizard) + PDF-Routen (Angebot,
                          Zusammenfassung, Vollmacht-Vordruck)
    konto/                Kundenkonto: Registrieren/Anmelden/Passwort, Dashboard,
                          Dossier-PDF (nur eigene Vorgänge); Guard: requireKunde
    einladung/[token]/    Annahme von Team-Einladungen (14 Tage, einmalig)
  components/
    journey/              Journey-Wizard: schritt-* Komponenten, register-suche,
                          verbund-suche, signatur-pad, ampel, fortschritt …
    admin/                Vorgänge-Liste, Datenblatt, Uploads, Benutzerverwaltung …
    konto/ · consent/     Status-Badges, Auth-Formen, Cookie-Banner
    kmu/                  Landingpage-Check: kmu-check.tsx (Wizard, 'use client'),
                          live-evaluation.tsx, phone-input.tsx …
    elements/ · sections/ · icons/   Oatmeal-Komponenten (re-skinnt)
  lib/
    kmu.ts                EU-KMU-Berechnung + Förderquote (reine Funktionen, keine
                          React-Abhängigkeit) – fachlicher Kern des Projekts
    journey/              SCHRITTE-Definition (einzige Quelle für Wizard/Validierung),
                          actions.ts (Server Actions, Audit), schemas.ts (zod)
    db/                   pg-Pool + Repositories (angebote, journey, kunden, …);
                          ssl.ts: TLS-Pinning verify-full mit Supabase-Root-CA
    auth/                 Better-Auth-Instanz + Guards (requireAdmin/requireKunde)
    openregister/         Server-only REST-Client, mapping.ts (zyklenfester BFS
                          über die Beteiligungskette, KETTEN_LIMITS), Cache
    email/                Resend-Notify (best effort) + Templates
    dossier/ · systemkonzept/ · vollmacht/   Serverseitige PDF-Generatoren (pdf-lib)
    storage/blob.ts       Vercel-Blob-Upload (privat)
    rate-limit.ts         In-Memory-Fixed-Window (schützt kostenpflichtige APIs)
    webhook.ts            Webhook-URL-Auflösung (DB-Vorrang vor WEBHOOK_URL)
    tracking.ts           Marketing-Attribution (clientseitig)
    pdf.ts                Gebrandeter PDF-Nachweis (clientseitig, jsPDF)

_oatmeal_template/        Unverändertes Original-Template (Referenz, NICHT Teil
                          des Builds; in tsconfig/eslint/next.config ausgeschlossen)

supabase/schemas/         Deklaratives DB-Schema, 25 Migrationen (01_extensions …
                          25_bescheid_verwendungsnachweis), alle ANGEWENDET. Kern:
                          angebote (Vorgang), stammdaten, beteiligungen, kmu_
                          bewertungen, deminimis_*, vollmachten, dokumente,
                          uebergaben, audit_events (append-only), einstellungen,
                          benutzer_einladungen, openregister_cache, kunden_zugriffe,
                          bescheide/verwendungsnachweise/vnw_belege (Migration 25:
                          Prozess nach der Einreichung – Bescheid, Fristen, VNW).
                          IDs seit Migration 14 UUIDv7 (uuid_v7() in 14_uuid_v7.sql);
                          Klartext-Tokens nie gespeichert (nur SHA-256 via digest()).
scripts/
  db-apply.mjs            Wendet supabase/schemas/ auf DATABASE_URL an
  db-verify.mjs           Verifikations-Checks (RLS, FK-Indizes, Constraints,
                          Trigger, Rechte) – nach jeder Schema-Änderung laufen lassen
  create-admin.mjs        Legt Vertriebs-/Admin-Konten an (Rolle nie aus dem Client)
  e2e-journey.mjs · e2e-testdaten.mjs   End-to-End-Durchlauf der Journey
docs/PLAN-foerderportal.md Gesamtkonzept Förderportal (Journey, Architektur,
                          DB-Layout, Meilensteine, offene Entscheidungen)
.agents/skills/           Supabase-Agent-Skills (verbindlich für DB-Arbeiten)
```

**DB-Konventionen (verbindlich, Details in `supabase/schemas/`):** Enum-Typen statt
Freitext, `numeric(14,2)` für Geld, `timestamptz`, FK-Indizes + CHECK-Constraints,
RLS Deny-by-default (Zugriff nur serverseitig via Service-Role), Klartext-Tokens
werden nie gespeichert (nur SHA-256-Hash via `digest()`).

Path-Alias: `@/*` → `./src/*` (tsconfig).

## Fachlicher Kern: KMU-Berechnung (`src/lib/kmu.ts`)

- Schwellenwerte (EU 2003/361/EG): Kleinst < 10 JAE / ≤ 2 Mio. €; Klein < 50 JAE /
  ≤ 10 Mio. €; Mittel < 250 JAE / Umsatz ≤ 50 Mio. € **oder** Bilanzsumme ≤ 43 Mio. €.
- **Mitarbeiterzahl (JAE) ist bindend** (strikt „kleiner als“); beim Finanzkriterium
  genügt Umsatz **ODER** Bilanzsumme innerhalb der Grenze.
- Verbund-Logik: Beteiligungen < 25 % ignoriert; 25–50 % (Partner) anteilig;
  > 50 % (verbunden) zu 100 % zugerechnet; beide Richtungen.
- Förderquote BAFA Modul 3: kleinst/klein 45 %, mittel 35 %, kein KMU 25 %.
- Bei Änderungen an dieser Logik unbedingt `README.md` (Abschnitt „KMU-Berechnung“)
  und den Kommentar-Kopf in `kmu.ts` synchron halten.

## Konventionen & Code-Style

- Formatierung per **Prettier** (Config eingebettet in `package.json`): **keine
  Semikolons**, einfache Anführungszeichen, Zeilenbreite 120,
  Tailwind-Klassen-Sortierung (`tailwindStylesheet: ./src/app/globals.css`,
  `clsx` als Klassen-Funktion).
- Funktionale React-Komponenten, Props typisiert, `Readonly<{…}>` für Layout-Props.
- Client-Komponenten explizit mit `'use client'` markieren (`kmu-check.tsx` etc.);
  `src/lib/kmu.ts` bleibt bewusst framework-frei.
- Styling ausschließlich über Tailwind-Utilities mit den **definierten
  Farbtokens** (`mabe-*`, `teal-*`, `olive-*`) – keine neuen Ad-hoc-Farben
  außerhalb von `globals.css`.
- **White-Mode ist erzwungen**: die `dark:`-Variante ist an eine nie gesetzte
  `.dark`-Klasse gebunden (siehe Kommentar in `globals.css`); kein Dark-Mode
  einführen.
- Barrierefreiheit beachten: Fokus-Ringe (WCAG 2.4.7), `prefers-reduced-motion`,
  16px-Eingabeschrift auf Touch-Geräten (gegen iOS-Auto-Zoom), Pinch-Zoom bleibt
  erlaubt.
- `_oatmeal_template/` niemals ändern und nicht in den Build einbeziehen
  (ist in `tsconfig.json`, `eslint.config.mjs`, `next.config.ts` ausgeschlossen).
- **ENV-Zugriff nur über `src/env.ts`** (T3 Env): Fail-Fast-Validierung beim
  Import (Fehlformat = Build-/Start-Fehler), Werte bewusst optional gemäß
  Best-Effort-Muster; `process.env` außerhalb dieser Datei nicht anfassen
  (Ausnahme: Test-Fixtures in `*.test.ts`).
- **ESLint Strict (typed linting, `projectService`)** für Produktionscode:
  `no-floating-promises`, `no-explicit-any`, `no-misused-promises`,
  `restrict-template-expressions` – Ziel 0 Errors / 0 Warnings. Die
  `no-page-custom-font`-Deaktivierung im Root-Layout ist bewusst und
  dokumentiert (App-Router-False-Positive; Mona Sans liegt nicht im
  `next/font/google`-Katalog dieser Next-Version).

## Umgebungsvariablen & Sicherheit

- **`WEBHOOK_URL`** (nur serverseitig, kein `NEXT_PUBLIC_`-Präfix): Ziel-Endpoint
  für die Lead-Übergabe (Make/Zapier/n8n/CRM). In Vercel unter Project → Settings
  → Environment Variables anlegen (Production + Preview). Die URL wird **niemals
  an den Client ausgeliefert**.
- Ohne gesetzte `WEBHOOK_URL` akzeptiert `api/lead` den Lead weiterhin (Antwort
  `ok: true, forwarded: false`) und loggt eine Warnung – bewusstes Design, kein
  Datenverlust für den Nutzer.
- Die API-Route reichert Payloads serverseitig an (IP via `x-forwarded-for`,
  Geo-Header `x-vercel-ip-*`, User-Agent, Empfangszeit) und leitet per `fetch`
  an den Webhook weiter; Webhook-Fehler → HTTP 502.
- Der Lead-Flow verarbeitet **personenbezogene Daten** (Name, E-Mail, Telefon,
  Tracking-IDs, Fingerprint, IP): DSGVO-Einwilligung ist Pflichtfeld im Formular;
  keine zusätzliche Erfassung ohne Einwilligungs-Checkbox einführen.
- Keine Secrets in den Client-Code; keine neuen externen Endpunkte ohne
  serverseitige Route (Muster wie `api/lead`).
- **Supabase** (`.env.local`, liegt lokal + in Vercel): `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Client, `sb_publishable_…`);
  `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_…`) und `DATABASE_URL` **nur serverseitig**
  – niemals mit `NEXT_PUBLIC_`-Präfix, niemals in Client-Komponenten importieren.
- **Portal-ENV** (Vollständige Liste + Werte-Schema in `README.md`):
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (echte Domain, kein localhost),
  `NEXT_PUBLIC_APP_URL` (Basis für E-Mail-Links), `RESEND_API_KEY` + `EMAIL_FROM`
  (best effort, Ausfall blockiert nie), `BLOB_READ_WRITE_TOKEN` (Vercel Blob;
  ohne Token wird Upload still übersprungen), `GEMINI_API_KEY`, `OPENREGISTER_API_KEY`.
- **IPv6/Pooler-Falle (WICHTIG):** Der Supabase-Direct-Host `db.<ref>.supabase.co` ist
  **IPv6-only** und von Vercel aus nicht erreichbar (Symptom: HTTP 500 auf `/admin`,
  `/v/[token]`, `/api/auth/*`). Auf Vercel daher **immer den Session-Pooler**
  (`aws-1-eu-west-1.pooler.supabase.com`, Port 5432, User `postgres.<ref>`) in
  `DATABASE_URL` verwenden. Remote-Diagnose: `GET /api/health`.
- **TLS-Pinning:** DB-Verbindungen nutzen `verify-full` mit gepinnter Supabase-Root-CA
  (`certs/supabase-prod-ca.crt`, geladen via `src/lib/db/ssl.ts`).
- **Integrationen** (nur serverseitig): `GEMINI_API_KEY` (Angebots-PDF-Extraktion),
  `OPENREGISTER_API_KEY` (Unternehmens-/Verbunddaten; Bearer-Auth, Suche = 1 Credit,
  Detail-Endpunkte = 10, Geldwerte in Cents → Umrechnung im Code; `company_id`
  immer aus der Suche beziehen, nie selbst bauen).

## Deployment

- Vercel (Framework-Preset Next.js). Produktions-Check lokal: `npm run build`.
- `next.config.ts`: `outputFileTracingExcludes` für `_oatmeal_template/`;
  `outputFileTracingIncludes` bindet die BAFA-Vollmacht-/Vorlagen-PDFs
  (`docs/vorlagen/*.pdf`) in die Serverless-Bundles von `/v/*` und `/vorlagen/*` ein;
  `serverActions.bodySizeLimit: '16mb'` für PDF-Uploads in Server Actions.
- Nach Deploy auf Vercel: `GET /api/health` prüfen (200 = ENV + DB ok, 503 = Details
  im Body, Werte werden nie ausgeliefert, nur true/false).
