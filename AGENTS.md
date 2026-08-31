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

Die Projektsprache ist **Deutsch**: UI-Texte, Code-Kommentare, Doku und Commit-Kontext
werden auf Deutsch verfasst. Einige Kommentare in den Oatmeal-Template-Komponenten sind
noch englisch (Template-Ursprung) – das ist so gewollt und muss nicht geändert werden.

## Technologie-Stack

- **Next.js 16** (App Router) + **React 19**, TypeScript (strict)
- **Tailwind CSS v4** (CSS-first via `@import 'tailwindcss'` + `@theme` in
  `src/app/globals.css`, kein `tailwind.config`)
- `@tailwindplus/elements` (Tailwind-Plus-UI-Primitives), `clsx`
- `jspdf` für den clientseitigen PDF-Nachweis (dynamischer Import in `src/lib/pdf.ts`)
- `@fingerprintjs/fingerprintjs` für die Visitor-ID im Tracking
- **Supabase** (Postgres 17, EU): `@supabase/supabase-js` + `@supabase/ssr` installiert,
  `pg` als direkter DB-Treiber für Skripte/Better-Auth-Adapter
- **Gemini API** (serverseitig): Extraktion der Angebots-PDFs (`GEMINI_API_KEY`)
- **openregister.de API** (serverseitig): Unternehmens-/Verbunddaten
  (`OPENREGISTER_API_KEY`, Bearer-Auth, Geldwerte in **Cents**)
- Deployment: **Vercel** (`vercel.json` setzt nur `"framework": "nextjs"`)

## Build- und Test-Kommandos

```bash
npm install        # Abhängigkeiten installieren
npm run dev        # Dev-Server auf http://localhost:3000
npm run build      # Produktions-Build
npm start          # Produktions-Server
npm run lint       # ESLint (eslint-config-next, Flat Config)
```

- **Es gibt keine Test-Suite** (kein Jest/Vitest o. ä.). Verifikation erfolgt über
  `npm run lint` und `npm run build`. Die KMU-Berechnungslogik wurde manuell gegen
  offizielle Quellen geprüft (Edge-Case-Tests, dokumentiert in `README.md`); bei
  Änderungen an `src/lib/kmu.ts` die Schwellenwerte gegen die dort verlinkten
  EU-Quellen verifizieren.

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
  components/
    kmu/                  Projektspezifisch: kmu-check.tsx (Wizard, ~1000 Zeilen,
                          'use client'), live-evaluation.tsx, field.tsx,
                          phone-input.tsx, mabe-logo.tsx, hero-background.tsx,
                          linkedin-icon.tsx
    elements/             Re-skinnnte Oatmeal-Primitives (button, container, …)
    sections/             Re-skinnnte Oatmeal-Sektionen (hero, faqs, footer, …)
    icons/                Oatmeal-Icon-Set (nur hier pflegen, nicht neu erfinden)
  lib/
    kmu.ts                EU-KMU-Berechnung + Förderquote (reine Funktionen, keine
                          React-Abhängigkeit) – fachlicher Kern des Projekts
    tracking.ts           Marketing-Attribution (gclid/fbclid/UTM/Cookies/
                          FingerprintJS) – läuft nur clientseitig
    pdf.ts                Gebrandeter PDF-Nachweis (clientseitig, jsPDF)

_oatmeal_template/        Unverändertes Original-Template (Referenz, NICHT Teil
                          des Builds; in tsconfig/eslint/next.config ausgeschlossen)

supabase/schemas/         Deklaratives DB-Schema (01_extensions … 06_rls), auf
                          Supabase ANGEWENDET und verifiziert; 07_auth_fk.sql.disabled
                          erst nach Better-Auth-Setup einspielen
scripts/
  db-apply.mjs            Wendet supabase/schemas/ auf DATABASE_URL an
  db-verify.mjs           17 Verifikations-Checks (RLS, FK-Indizes, Constraints,
                          Trigger, Rechte) – nach jeder Schema-Änderung laufen lassen
docs/PLAN-foerderportal.md Gesamtkonzept Förderportal (Journey, Architektur,
                          DB-Layout, Meilensteine M0–M6, offene Entscheidungen)
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
- **Integrationen** (nur serverseitig): `GEMINI_API_KEY` (Angebots-PDF-Extraktion),
  `OPENREGISTER_API_KEY` (Unternehmens-/Verbunddaten; Bearer-Auth, Suche = 1 Credit,
  Detail-Endpunkte = 10, Geldwerte in Cents → Umrechnung im Code; `company_id`
  immer aus der Suche beziehen, nie selbst bauen).

## Deployment

- Vercel (Framework-Preset Next.js). Produktions-Check lokal: `npm run build`.
- `next.config.ts` enthält nur `outputFileTracingExcludes` für `_oatmeal_template/`.
