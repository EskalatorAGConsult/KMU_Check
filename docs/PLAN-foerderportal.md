# MABE Förderportal – Systemkonzept & Umsetzungsplan

Stand: 31.08.2026 · Status: Konzept zur Abstimmung (noch kein Code)

---

## 1. Zielbild

Aus der bestehenden Landingpage (öffentlicher KMU-Check, `mabe-kmu-check.vercel.app`) wird ein
**zweistufiges Portal** mit zwei Akteuren:

| Rolle | Wer | Was |
|---|---|---|
| **Vertrieb (Admin)** | MABE Maschinen- und Behälterbau GmbH | Angebot anlegen (technische Daten aus dem MABE-Angebot zu MABE Smart Control), Kunden einladen, Journey-Status verfolgen |
| **Antragsteller (Kunde)** | Endkunde von MABE | Erhält einen eindeutigen Link, sieht „sein“ Angebot, ergänzt Stammdaten, KMU-Status, Verbund, De-minimis, Vollmacht und wählt den Beantragungsweg |

Danach (Phase 2+, nicht Teil dieses Plans): Rolle **Eskalator AG** als Fördermittel-Concierge mit
eigener Sicht auf übergebene Vorgänge.

**Fachlicher Rahmen:** BAFA-Förderung „Energie- und Ressourceneffizienz in der Wirtschaft (EEW) –
Zuschuss“, **Modul 3: MSR-Technik, Sensorik und Energiemanagementsoftware**. Förderquoten
45 % / 35 % / 25 % je nach KMU-Status (im bestehenden `src/lib/kmu.ts` bereits korrekt abgebildet).
Antragstellung seit 15.09.2025 über das FZD-Onlineportal; bei Bevollmächtigung ist eine
unterschriebene Vollmacht erforderlich; Vorhabenbeginn erst nach Antragstellung.

---

## 2. Recherche-Ergebnisse (fachliche Grundlagen)

### 2.1 Zielformular (n8n, Eskalator)

Das bestehende n8n-Formular (8 Abschnitte) wurde vollständig ausgelesen. Es definiert die
**Zieldaten**, die unser Portal liefern muss:

1. **Unternehmen**: Name, Land, PLZ, Ort, Straße+Hausnr., E-Mail, **WZ-Code (2008)**,
   Unternehmensart (eigenständig / Partner / verbunden), Vorsteuerabzugsberechtigt (ja/nein),
   natürliche vs. juristische Person, Geburtsdatum + Steuer-ID (nat. Person) bzw. Steuernummer
   (jur. Person)
2. **Ansprechpartner**: Rolle, Anrede, Vorname, Nachname, E-Mail
3. **Angaben zum Antrag**: Gruppenzugehörigkeit (privat / kommunal / Landesunternehmen /
   freiberuflich / Contractor), wirtschaftlich tätig (ja/nein)
4. **Bankverbindung**: Kontoinhaber, IBAN
5. **KMU-Einstufung**: Ist KMU, Einordnung, Kennzahlen der Jahre 2024 + 2025
   (Beschäftigte, Umsatz, Bilanzsumme, jeweils „Geschäftsjahr abgeschlossen?“)
6. **Standort der Maßnahme**: PLZ, Stadt, Straße (falls abweichend)
7. **Technische Maßnahme**: Energiemanagementsoftware (MABE Cloud / andere / offen),
   Investitionsgesamtkosten je Technologie, Anzahl Sensoren (+ mit Prozessbezug),
   Systemkonzept mit Datenerfassungsplan / Wirkplan, voraussichtliches Projektende
8. **Vollmacht & Bestätigung**: Vollmacht (PDF), Bestätigung „Vorhaben noch nicht begonnen“

**Lücke im n8n-Formular:** De-minimis fehlt dort komplett – wir bauen es im Portal **neu dazu**
(siehe 2.2) und reichern die Übergabe entsprechend an.

### 2.2 De-minimis (recherchiert, EU VO 2023/2831)

- Höchstbetrag: **300.000 €** je „einzigem Unternehmen“ in einem **rollierenden 3-Jahres-Zeitraum**
  (seit 01.01.2024; davor 200.000 € nach VO 1407/2013). Sektorsonderwerte: Agrar 20.000 €,
  Fischerei 30.000 €, Straßengüterverkehr 100.000 €.
- Die EEW kann wahlweise nach **AGVO oder De-minimis-VO** gewährt werden; bei De-minimis ist eine
  **De-minimis-Erklärung Bestandteil des Antrags**.
- Inhalt der Erklärung (aus BAFA-/Länder-Vordrucken abgeleitet – unsere Felder):
  - je Beihilfe: **Beihilfegeber/Zuwendungsgeber, Aktenzeichen/Kontonummer, Datum der
    Bewilligung/Zusage, Beihilfewert in €, Form (Zuschuss/Darlehen/Bürgschaft),
    Kategorie (Allgemein/Agrar/Fisch), Status (gewährt / beantragt, noch nicht bewilligt)**
  - Fragen zu **Fusion/Übernahme** und **Unternehmensaufspaltung** in den letzten 3 Jahren
  - „Einziges Unternehmen“ i. S. d. Art. 2 Abs. 2: **verbundene Unternehmen werden
    zusammengerechnet** → direkter fachlicher Anknüpfungspunkt an unsere bestehende Verbund-Logik
  - Hinweistext: Angaben sind **subventionserheblich (§ 264 StGB i. V. m. SubvG)**
- UX-Mehrwert im Portal: Live-Summe + Restbudget-Anzeige („Noch X € von 300.000 € verfügbar“),
  Warnung bei Überschreitung.

### 2.3 Vollmacht & Beantragungsweg

- BAFA akzeptiert Antragstellung durch Bevollmächtigte mit **unterschriebener Vollmacht**.
- Umsetzung im Portal: Vollmacht wird aus den Stammdaten **automatisch als PDF vorbefüllt**
  (Vollmachtgeber = Antragsteller, Vollmachtnehmer = Eskalator AG bzw. bei Eigenbeantragung
  entfällt sie). Unterschrift: online per Signatur-Canvas oder Upload des unterschriebenen PDFs.
- Bestätigung „Vorhabenbeginn noch nicht erfolgt“ ist Pflicht (bereits im n8n-Formular).

---

## 3. Customer Journey

### 3.1 Vertrieb (Admin-Bereich, `/admin`)

1. **Login** (E-Mail + Passwort, optional Magic Link; Rolle `admin`).
2. **Angebot anlegen** – Vertrieb lädt das **MABE-Angebots-PDF** hoch; die technischen Daten
   werden **per Gemini API automatisch extrahiert** (siehe 4.4), der Vertrieb prüft und
   bestätigt die Werte (Human-in-the-loop, nichts geht ungesehen an den Kunden):
   - Kunde: Firma, Ansprechpartner, E-Mail (für die Einladung)
   - Angebot (aus PDF extrahiert, korrigierbar): Angebotsnummer, Angebotsdatum, Technologien
     (Energiemanagementsoftware / Mess- & Sensortechnik / Steuerungs- & Regelungstechnik),
     Software-Variante (MABE Cloud / andere / offen), Investitionskosten je Technologie,
     **Messpunkte/Sensoren gesamt + mit Prozessbezug** (für den Modul-3-Antrag zwingend),
     voraussichtliches Projektende, Freitext-Notiz
   - Das Original-PDF wird im privaten Storage abgelegt (Antrags-Anlage)
3. System erzeugt **einmaligen Kunden-Link** (`/v/<token>`) + versendet Einladungs-E-Mail
   (oder Link zum Kopieren).
4. **Dashboard**: Liste aller Vorgänge mit Status-Badges
   (`angelegt → eingeladen → in Bearbeitung → eingereicht → abgeschlossen`), Detailansicht mit
   allen Kundendaten, erzeugten Dokumenten und Audit-Verlauf.

### 3.2 Kunde (Journey unter `/v/<token>`)

Geführter Wizard mit Fortschrittsanzeige, Zwischenspeichern („Später fortfahren“ – der Link
bleibt gültig) und klarem Wording:

| Schritt | Titel (Wording) | Inhalt |
|---|---|---|
| 0 | „Ihr Förderprojekt auf einen Blick“ | Angebot vom Vertrieb: Technologien, Kosten, **live berechnete Förderquote & voraussichtlicher Zuschuss in €** (sofortiger Nutzen-Moment) |
| 1 | „Ihr Unternehmen“ | Stammdaten (Abschnitt 1 des Zielformulars, inkl. WZ-Code mit Such-Auswahl, Vorsteuerabzug, Personenart mit bedingten Feldern). **Vorbefüllung per openregister.de:** Kunde sucht seine Firma, Name/Adresse/Rechtsform/Registerdaten werden übernommen |
| 2 | „Ihr Ansprechpartner“ | Abschnitt 2 des Zielformulars |
| 3 | „Ihr KMU-Status“ | **Wiederverwendung der bestehenden KMU-Engine** (`src/lib/kmu.ts`): eigene Kennzahlen + Verbund (Partner-/verbundene Unternehmen), Live-Ergebnis, Kennzahlen für 2 Geschäftsjahre (Zwei-Jahres-Regel). **Vorbefüllung per openregister.de:** Gesellschafter (aufwärts) + Beteiligungen (abwärts) mit Anteilsquoten sowie Finanzkennzahlen (Umsatz/Bilanzsumme/Mitarbeiter) werden als editierbarer Vorschlag übernommen – der Kunde bestätigt jede Zeile |
| 4 | „De-minimis-Erklärung“ | Beihilfen-Tabelle der letzten 3 Jahre, Fusion/Übernahme-Fragen, Live-Summe gegen 300.000 €, § 264-StGB-Hinweis, Checkbox-Bestätigung |
| 5 | „Antragsdaten & Bankverbindung“ | Gruppenzugehörigkeit, wirtschaftlich tätig, Standort der Maßnahme, IBAN (mit Validierung) |
| 6 | „Vollmacht & Beantragungsweg“ | **Wahl:** „Beantragung durch unser Unternehmen selbst“ **oder** „Beantragung durch den Fördermittel-Concierge der Eskalator AG“ (favorisiert, als empfohlene Karte gestaltet). Bei Eskalator: Vollmacht online ansehen, unterschreiben (Signatur-Canvas) oder unterschrieben hochladen. Pflicht-Checkbox „Vorhaben noch nicht begonnen“. DSGVO-Einwilligung. |
| 7 | „Prüfen & Absenden“ | Zusammenfassung aller Angaben, finaler Hinweis auf Subventionserheblichkeit, Absenden → Bestätigungsseite mit Fallnummer + PDF-Dossier zum Download |

### 3.3 Übergabe nach Absenden

- Vorgang wird als `eingereicht` markiert, komplettes Dossier (JSON + Vollmacht-PDF +
  Antrags-PDF) wird an den **bestehenden n8n-Webhook** der Eskalator übergeben
  (Muster wie `api/lead`: serverseitig, URL nur in Env-Variable).
- Der bisherige n8n-Endpunkt bleibt Zielsystem; unser Portal ersetzt das manuelle Ausfüllen
  des n8n-Formulars durch den Kunden.

---

## 4. Architektur

### 4.1 Stack-Entscheidungen

- **Weiterhin:** Next.js 16 (App Router), React 19, Tailwind v4, MABE-CI, White-Mode.
- **Datenbank:** Supabase (Postgres, **EU-Region** wegen DSGVO).
- **Auth:** **Better Auth** (E-Mail/Passwort + Magic Link) mit Postgres-Adapter gegen die
  Supabase-Datenbank. Rollen über eigenes `role`-Feld am User.
- **Datenzugriff:** ausschließlich **serverseitig** (Route Handlers / Server Actions) über den
  Supabase-Service-Role-Key (Server-Client via `@supabase/ssr`, bereits installiert).
  Der Client spricht nie direkt mit der Datenbank.
  → Damit entfällt die Komplexität von RLS-Policies; Autorisierung passiert zentral in einer
  dünnen Server-Schicht (`requireAdmin()`, `requireValidToken()`). Supabase RLS wird trotzdem
  aktiviert (Deny-by-default) als Tiefenverteidigung.
- **Dateien:** Supabase Storage (privater Bucket), Zugriff nur über serverseitig erzeugte
  signierte URLs (Vollmacht, generierte PDFs, Uploads).
- **Validierung:** Zod-Schemas, die zwischen Client-Formularen, Server-Actions und DB geteilt
  werden (Single Source of Truth pro Schritt).
- **E-Mail:** transaktional (Resend / SMTP über Supabase) für Einladung + Bestätigung.

### 4.2 Unique-Link-Design (Sicherheit)

- Token: 128 Bit aus CSPRNG (`crypto.randomBytes`), URL-safe Base64.
- In der DB wird nur der **SHA-256-Hash** gespeichert – ein DB-Leak kompromittiert keine Links.
- Eigenschaften: Ablaufdatum (Default 90 Tage, vom Vertrieb verlängerbar), widerrufbar,
  optional Einmal-Abschluss (nach `eingereicht` nur noch lesbar).
- Rate-Limiting auf der Token-Route gegen Brute-Force.

### 4.3 Modularisierung (kein AI-Slop, klare Verantwortlichkeiten)

```
src/
  app/
    (public)/            bestehende Landingpage (unverändert)
    admin/               Vertriebsbereich (geschützt, Middleware-Guard)
      angebote/          Liste, Neu, Detail
    v/[token]/           Kunden-Journey (Wizard, schrittweise RSC + Client-Steps)
    api/
      lead/route.ts      bestehend (bleibt)
      journey/...        serverseitige Endpunkte der Journey
      webhook/...        Übergabe an Eskalator/n8n
  lib/
    kmu.ts               bestehend (unverändert, fachlicher Kern)
    deminimis.ts         NEU: 3-Jahres-Summe, Restbudget, Validierung (reine Funktionen,
                         gleicher Stil wie kmu.ts: framework-frei, kommentierte Schwellenwerte
                         + Quellenverweis VO (EU) 2023/2831)
    iban.ts              NEU: IBAN-Validierung (ISO 13616, mod-97)
    wz-codes.ts          NEU: WZ-2008-Katalog (reduziert auf relevante Branchen)
    db/                  NEU: Supabase-Client (nur serverseitig), Repositories pro Entität
    auth/                NEU: Better-Auth-Setup, Guards
    tokens.ts            NEU: Token-Erzeugung/-Hashing/-Prüfung
    gemini/              NEU: Angebots-PDF-Extraktion (Prompt + JSON-Schema versioniert)
    openregister/        NEU: SDK-Wrapper (Suche, Owners, Holdings, Financials, Cent→EUR)
    pdf/                 NEU: Vollmachts-PDF + Antrags-Dossier (serverseitig)
    journey/schemas.ts   NEU: Zod-Schemas je Wizard-Schritt (geteilt Client/Server)
  components/
    kmu/                 bestehend
    journey/             NEU: Wizard-Shell, Schritt-Komponenten, Fortschrittsanzeige,
                         SignatureCanvas, DeminimisTable, OfferSummary
    admin/               NEU: Dashboard, Angebotsformular, Status-Badges
```

Prinzipien: fachliche Logik (KMU, De-minimis, IBAN) bleibt **reine TypeScript-Funktionen ohne
Framework-Abhängigkeit** und damit isoliert testbar; UI und Datenzugriff sind strikt getrennt.

### 4.4 Externe Integrationen (recherchiert & mit Live-Tests verifiziert, 31.08.2026)

Beide APIs laufen **ausschließlich serverseitig** (Keys in `.env.local` ohne `NEXT_PUBLIC_`-Prefix,
bereits eingetragen; Keys stehen auch in Vercel).

#### a) Gemini API – Angebots-PDF-Parsing (`GEMINI_API_KEY`, Key getestet ✅)

- **Fakten (verifiziert):** Key gültig; `gemini-2.5-flash` verfügbar (multimodal, 1 Mio.
  Token Kontext). Gemini verarbeitet PDFs nativ (Document Understanding) und liefert über
  `responseMimeType: 'application/json'` + `responseSchema` **garantiert schema-konformes
  JSON** (Structured Output).
- **Einsatz:** Beim Anlegen eines Angebots lädt der Vertrieb das MABE-Angebots-PDF hoch →
  serverseitiger Extraktionslauf mit festem Zod/JSON-Schema (Angebotsnummer, -datum,
  Technologien, Software-Variante, Investitionskosten je Technologie, **Messpunkte/Sensoren
  gesamt + mit Prozessbezug**, Projektende) → Ergebnis landet als **Entwurf** im
  Angebotsformular; der Vertrieb prüft und bestätigt (Human-in-the-loop).
- **Qualitätsregeln:** Extraktion niemals ungeprüft übernehmen; Konfidenz-/„nicht gefunden“-
  Marker pro Feld; Original-PDF bleibt als Antrags-Anlage im Storage; Modellversion und Prompt
  versioniert in `lib/gemini/`, Retry mit Backoff, Timeout, Kosten-Logging.

#### b) openregister.de – Unternehmens- & Verbunddaten (`OPENREGISTER_API_KEY`, Key getestet ✅)

- **Fakten (verifiziert via offizieller Doku `docs.openregister.de` + Live-Call):**
  REST-API `https://api.openregister.de`, Auth `Authorization: Bearer`, offizielles
  **TypeScript-SDK `openregister`** (npm). Reale Testantwort auf
  `/v1/autocomplete/company?query=MABE Maschinen` mit `company_id`, Adresse, Rechtsform,
  Registergericht/-nummer erhalten.
- **Endpunkte & Credit-Kosten (offiziell):** Autocomplete/Suche **1 Credit**;
  Company-Details, **Owners (Gesellschafter m. Anteilsquoten)**, **Holdings (Beteiligungen/
  Töchter)**, **Financials (Umsatz, Bilanzsumme, Mitarbeiter)** je **10 Credits**;
  UBO/Historie 25. **Geldwerte in Cents** (Umrechnung im Code!). `realtime=true` verdoppelt
  Kosten → nicht verwenden. `company_id` niemals selbst bauen, immer aus der Suche.
- **Einsatz in der Journey:**
  1. **Schritt 1 (Stammdaten):** Firmensuche (Autocomplete) → Vorbefüllung Name, Anschrift,
     Rechtsform, Registerdaten.
  2. **Schritt 3 (KMU/Verbund):** `company-owners` → Gesellschafter mit Anteilsquoten
     (**aufwärts**), `company-holdings` → Beteiligungen/Töchter (**abwärts**) → Vorschlagsliste
     für die `beteiligungen`-Tabelle, direkt anschlussfähig an die 25–50 %-Partner- bzw.
     > 50 %-Verbundenen-Logik in `kmu.ts`. `company-financials` → Vorschlagswerte für
     Umsatz/Bilanzsumme/Mitarbeiter.
  3. Jede vorbefüllte Zeile ist **editierbar und muss vom Kunden bestätigt** werden
     (Registerdaten können vom letzten Geschäftsjahr abweichen; maßgeblich bleiben die
     Kundenangaben).
- **Kostenregeln:** Ergebnisse je `company_id` als JSONB-Snapshot in der DB cachen, kein
  Polling; Suche statt Detail-Endpunkte beim Explorieren; Credit-Verbrauch loggen
  (Free-Plan: 500 Credits/Monat).

#### DB-Ergänzungen für beide Integrationen

```sql
alter table angebote
  add column angebot_pdf_path text,                       -- Original-PDF (privater Bucket)
  add column extraktion jsonb,                            -- Gemini-Ergebnis (roh)
  add column extrahiert_am timestamptz,
  add column extraktion_bestaetigt boolean not null default false;

alter table stammdaten
  add column register_company_id text,                    -- z. B. 'DE-HRB-U1104-36688'
  add column register_snapshot jsonb,                     -- Cache: Details/Owners/Financials
  add column register_abgerufen_am timestamptz;
```

`lib/gemini/` (PDF-Upload, Prompt+Schema versioniert, Parser) und `lib/openregister/`
(typsicherer SDK-Wrapper, Cent→EUR-Umrechnung, Mapping auf `beteiligungen`) als reine
serverseitige Module, Fehler bei API-Ausfall brechen den Flow **nicht** (Fallback:
manuelle Eingabe wie bisher).

---

## 5. Datenbank-Layout (Postgres/Supabase, modernisiert)

> **Status 31.08.2026: IMPLEMENTIERT & VERIFIZIERT.** Das Schema liegt als deklarative
> SQL-Dateien in `supabase/schemas/` (01_extensions … 06_rls), wurde auf die
> Supabase-Datenbank angewendet (`node scripts/db-apply.mjs`) und mit 17 automatisierten
> Checks verifiziert (`node scripts/db-verify.mjs` – Tabellen, RLS, FK-Indizes,
> Constraint-Positiv-/Negativfälle, Trigger, Rechte: alles grün).
> `07_auth_fk.sql.disabled` wird nach dem Better-Auth-Setup eingespielt (FK `angelegt_von`
> → `"user"(id)`). Die untenstehende DDL ist die Referenz; bei Abweichungen gilt der
> Stand in `supabase/schemas/`.

Grundlage sind die installierten Supabase-Agent-Skills
(`.agents/skills/supabase` + `supabase-postgres-best-practices`). Verbindliche Designregeln:

- **Deklaratives Schema** in `supabase/schemas/`, Migrationen daraus generiert
  (`supabase db pull`); nach jeder Schema-Änderung **`supabase db advisors`** ausführen.
- **Postgres-native Typen:** `enum`-Typen statt Freitext, `citext` für E-Mails,
  `numeric(14,2)` für Geldbeträge (kein `float`), `timestamptz` überall,
  `uuid`-PKs via `gen_random_uuid()`, `bytea` für Token-Hashes, `inet` für IPs, `jsonb` für Snapshots.
- **Integrität in der DB erzwungen**, nicht nur im Code: FKs mit `on delete`-Verhalten,
  `check`-Constraints (Wertebereiche, z. B. Beteiligungsquote 0–100, Förderquote in (25,35,45)),
  `unique` wo fachlich eindeutig (1:1-Beziehungen), `not null` konsequent.
- **Jeder FK bekommt einen Index**; dazu Partial Indexes auf Hot Paths
  (Admin-Dashboard: Filter auf `status`, Token-Lookup auf `token_hash`).
- **`updated_at` zentral per Trigger-Funktion** (eine Funktion, Trigger pro Tabelle).
- **RLS auf jeder Tabelle aktiviert + Rechte für `anon`/`authenticated` entzogen**
  (Deny-by-default). Datenzugriff ausschließlich serverseitig via Service-Role (bypassed RLS).
  Policies werden erst ergänzt, wenn künftige Rollen (z. B. Eskalator-Login) direkt lesen dürfen.
- **TypeScript-Typen nicht von Hand pflegen:** generiert via
  `supabase gen types typescript --local > src/lib/db/database.types.ts` (im Build-Skript).
- Better Auth bringt eigene Tabellen mit (`user`, `session`, `account`, `verification`);
  fachliche Tabellen referenzieren `"user"(id)` für die Admin-Zuordnung.

### 5.1 Enum-Typen

```sql
create type angebot_status as enum
  ('angelegt','eingeladen','in_bearbeitung','eingereicht','abgeschlossen','widerrufen');
create type technologie as enum ('software','messtechnik','steuerung');
create type software_variante as enum ('mabe_cloud','andere','offen');
create type unternehmensart as enum ('eigenstaendig','partner','verbunden');
create type personenart as enum ('natuerlich','juristisch');
create type gruppenzugehoerigkeit as enum
  ('privat','kommunal','land','freiberuflich','contractor');
create type beteiligung_richtung as enum ('abwaerts','aufwaerts');
create type kmu_kategorie as enum ('kleinst','klein','mittel','gross');
create type beihilfe_form as enum ('zuschuss','darlehen','buergschaft');
create type beihilfe_kategorie as enum ('allgemein','agrar','fisch');
create type beihilfe_status as enum ('gewaehrt','beantragt');
create type beantragungsweg as enum ('selbst','eskalator');
create type signatur_modus as enum ('canvas','upload');
create type dokument_typ as enum ('vollmacht','dossier','upload');
```

### 5.2 Tabellen (DDL-Kern)

```sql
-- Vertriebs-Angebot (vom Admin angelegt)
create table angebote (
  id                  uuid primary key default gen_random_uuid(),
  angelegt_von        uuid not null references "user"(id) on delete restrict,
  status              angebot_status not null default 'angelegt',
  -- Kunde (minimal; Rest ergänzt der Kunde in der Journey)
  kunde_firma         text not null check (char_length(kunde_firma) between 2 and 200),
  kunde_ansprechpartner text,
  kunde_email         citext not null,
  -- Technische Maßnahme (aus dem MABE-Angebot)
  angebot_nr          text not null,
  angebot_datum       date not null,
  technologien        technologie[] not null check (cardinality(technologien) >= 1),
  software_variante   software_variante,
  invest_software     numeric(14,2) check (invest_software >= 0),
  invest_messtechnik  numeric(14,2) check (invest_messtechnik >= 0),
  invest_steuerung    numeric(14,2) check (invest_steuerung >= 0),
  sensoren_gesamt     integer check (sensoren_gesamt >= 0),
  sensoren_prozessbezug integer check (sensoren_prozessbezug >= 0),
  projektende         date,
  notiz               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (sensoren_prozessbezug is null or sensoren_gesamt is null
         or sensoren_prozessbezug <= sensoren_gesamt)
);
create index angebote_status_idx on angebote (status)
  where status not in ('abgeschlossen','widerrufen');   -- Dashboard-Hot-Path
create index angebote_angelegt_von_idx on angebote (angelegt_von);

-- Einladungs-Link (nur SHA-256-Hash, nie der Klartext-Token)
create table journey_tokens (
  id           uuid primary key default gen_random_uuid(),
  angebot_id   uuid not null references angebote(id) on delete cascade,
  token_hash   bytea not null unique check (octet_length(token_hash) = 32),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);
-- Lookup passiert ausschließlich über den Hash:
create index journey_tokens_hash_idx on journey_tokens (token_hash)
  where revoked_at is null;

-- Kunden-Stammdaten (1:1 zum Angebot; Ziel = Abschnitte 1–5 des n8n-Formulars)
create table stammdaten (
  angebot_id          uuid primary key references angebote(id) on delete cascade,
  unternehmensname    text not null,
  land                text not null default 'Deutschland',
  plz                 text not null check (plz ~ '^\d{5}$'),
  ort                 text not null,
  strasse             text not null,
  email               citext not null,
  wz_code             text not null check (wz_code ~ '^\d{2}\.\d{2}'),
  unternehmensart     unternehmensart not null,
  vorsteuerabzug      boolean not null,
  personenart         personenart not null,
  geburtsdatum        date,
  steuer_id           text check (steuer_id ~ '^\d{11}$'),
  steuernummer        text,
  ap_rolle text, ap_anrede text, ap_vorname text, ap_nachname text, ap_email citext,
  gruppenzugehoerigkeit gruppenzugehoerigkeit not null,
  wirtschaftlich_taetig boolean not null,
  kontoinhaber        text,
  iban                text check (iban ~ '^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$'),
  standort_plz        text check (standort_plz ~ '^\d{5}$'),
  standort_ort        text,
  standort_strasse    text,
  vorhaben_nicht_begonnen boolean,
  dsgvo_einwilligung_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Bedingte Pflicht: natürliche Person -> Geburtsdatum + Steuer-ID,
  -- juristische Person -> Steuernummer
  check ((personenart = 'natuerlich' and geburtsdatum is not null and steuer_id is not null)
      or (personenart = 'juristisch' and steuernummer is not null))
);

-- Verbund (Partner-/verbundene Unternehmen), n:1 zum Vorgang
create table beteiligungen (
  id           uuid primary key default gen_random_uuid(),
  angebot_id   uuid not null references angebote(id) on delete cascade,
  name         text not null,
  richtung     beteiligung_richtung not null,
  anteil_pct   numeric(5,2) not null check (anteil_pct >= 25 and anteil_pct <= 100),
  jae          numeric(10,2) check (jae >= 0),
  umsatz       numeric(16,2) check (umsatz >= 0),
  bilanzsumme  numeric(16,2) check (bilanzsumme >= 0),
  created_at   timestamptz not null default now()
);
create index beteiligungen_angebot_idx on beteiligungen (angebot_id);

-- KMU-Kennzahlen + Ergebnis-Snapshot (2 Geschäftsjahre, Zwei-Jahres-Regel)
create table kmu_bewertungen (
  id              uuid primary key default gen_random_uuid(),
  angebot_id      uuid not null references angebote(id) on delete cascade,
  geschaeftsjahr  integer not null check (geschaeftsjahr between 2000 and 2100),
  abgeschlossen   boolean not null,
  jae             numeric(10,2) check (jae >= 0),
  umsatz          numeric(16,2) check (umsatz >= 0),
  bilanzsumme     numeric(16,2) check (bilanzsumme >= 0),
  kategorie       kmu_kategorie,
  foerderquote_pct integer check (foerderquote_pct in (25,35,45)),
  berechnung      jsonb,                    -- vollständiges KmuResult (Nachvollziehbarkeit)
  created_at      timestamptz not null default now(),
  unique (angebot_id, geschaeftsjahr)
);

-- De-minimis: einzelne Beihilfen (rollierender 3-Jahres-Zeitraum)
create table deminimis_beihilfen (
  id            uuid primary key default gen_random_uuid(),
  angebot_id    uuid not null references angebote(id) on delete cascade,
  beihilfegeber text not null,
  aktenzeichen  text,
  bewilligt_am  date not null,
  betrag        numeric(14,2) not null check (betrag >= 0),
  form          beihilfe_form not null,
  kategorie     beihilfe_kategorie not null default 'allgemein',
  status        beihilfe_status not null,
  created_at    timestamptz not null default now()
);
create index deminimis_angebot_idx on deminimis_beihilfen (angebot_id);

-- De-minimis: die Erklärung selbst (1:1, Snapshot beim Bestätigen)
create table deminimis_erklaerungen (
  angebot_id      uuid primary key references angebote(id) on delete cascade,
  fusion_3j       boolean not null,
  uebernahme_3j   boolean not null,
  aufspaltung_3j  boolean not null,
  summe_eur       numeric(14,2) not null check (summe_eur >= 0),
  bestaetigt_at   timestamptz not null      -- §-264-StGB-Hinweis bestätigt
);

-- Beantragungsweg + Vollmacht (1:1)
create table vollmachten (
  angebot_id        uuid primary key references angebote(id) on delete cascade,
  beantragungsweg   beantragungsweg not null,
  signatur_modus    signatur_modus,
  signatur_bild_path text,
  pdf_path          text,
  unterzeichnet_at  timestamptz,
  unterzeichnet_von text,
  unterschrift_ip   inet,
  unterschrift_ua   text,
  created_at        timestamptz not null default now(),
  -- Vollmacht nur bei Beantragung durch Eskalator erforderlich
  check (beantragungsweg = 'selbst' or unterzeichnet_at is null or pdf_path is not null)
);

-- Dokumente (generierte PDFs, Uploads; Dateien in privatem Storage-Bucket)
create table dokumente (
  id           uuid primary key default gen_random_uuid(),
  angebot_id   uuid not null references angebote(id) on delete cascade,
  typ          dokument_typ not null,
  storage_path text not null unique,
  created_at   timestamptz not null default now()
);
create index dokumente_angebot_idx on dokumente (angebot_id);

-- Übergabe an Eskalator/n8n (Retry-fähig, append-only)
create table uebergaben (
  id          uuid primary key default gen_random_uuid(),
  angebot_id  uuid not null references angebote(id) on delete cascade,
  payload     jsonb not null,
  http_status integer,
  erfolg      boolean not null,
  versucht_at timestamptz not null default now()
);
create index uebergaben_angebot_idx on uebergaben (angebot_id);

-- Audit-Log (append-only, DSGVO + Nachvollziehbarkeit)
create table audit_events (
  id          bigint generated always as identity primary key,
  angebot_id  uuid references angebote(id) on delete set null,
  actor       text not null,               -- admin:<user-id> | kunde:<token-id> | system
  aktion      text not null,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index audit_events_angebot_idx on audit_events (angebot_id, created_at desc);
```

### 5.3 Trigger, RLS, Rechte

```sql
-- Zentrale updated_at-Funktion (einmal, Trigger pro Tabelle)
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;  -- SECURITY INVOKER (Default) – kein SECURITY DEFINER nötig

create trigger t_angebote_updated   before update on angebote
  for each row execute function set_updated_at();
create trigger t_stammdaten_updated before update on stammdaten
  for each row execute function set_updated_at();

-- Deny-by-default: RLS an, keine Policies, Rechte entzogen.
-- Serverseitiger Zugriff läuft über die Service-Role (bypassed RLS).
alter table angebote              enable row level security;
alter table journey_tokens        enable row level security;
alter table stammdaten            enable row level security;
alter table beteiligungen         enable row level security;
alter table kmu_bewertungen       enable row level security;
alter table deminimis_beihilfen   enable row level security;
alter table deminimis_erklaerungen enable row level security;
alter table vollmachten           enable row level security;
alter table dokumente             enable row level security;
alter table uebergaben            enable row level security;
alter table audit_events          enable row level security;

revoke all on all tables in schema public from anon, authenticated;
```

Spätere Ausbaustufe (Eskalator-Login mit Supabase Auth oder JWT-Claim-Mapping):
Policies nach dem Ownership-Muster ergänzen, z. B.
`create policy ... to authenticated using ((select auth.uid()) = angelegt_von)` –
niemals `TO authenticated` ohne Ownership-Prädikat (BOLA/IDOR-Falle), UPDATE-Policies immer
mit `USING` + `WITH CHECK`.

---

## 6. Sicherheit & DSGVO

- **Sicherheitsleitplanken (ISO/IEC 27001-orientiert):** serverseitige Autorisierung an jeder
  Route, Token-Hashes, Rate-Limits, Security-Headers (CSP, HSTS via `next.config.ts`),
  keine Secrets im Client (Service-Role-Key nur serverseitig), Zod-Validierung aller Eingaben,
  Audit-Log aller sicherheitsrelevanten Aktionen.
- **Supabase-Security-Checkliste** (aus dem installierten Supabase-Skill, verbindlich):
  - Nur der **Publishable Key** (`sb_publishable_…`) geht an den Client (`NEXT_PUBLIC_…`);
    der **Service-Role-Key** bleibt serverseitig ohne `NEXT_PUBLIC_`-Prefix.
  - **RLS auf jeder Tabelle** im `public`-Schema (Deny-by-default, siehe 5.3); bei künftigen
    Policies: kein `auth.role()` (deprecated), kein `TO authenticated` ohne Ownership-Prädikat
    (BOLA/IDOR), UPDATE-Policies immer mit `USING` **und** `WITH CHECK`.
  - Keine `SECURITY DEFINER`-Funktionen, wo `SECURITY INVOKER` reicht; Views bei Postgres ≥ 15
    mit `security_invoker = true`.
  - Keine Authorization-Entscheidungen aus user-editierbaren `user_metadata`-Claims.
  - Nach jeder Schema-Änderung `supabase db advisors`; Paketversionen gepinnt + Lockfile committet.
  - Storage: privater Bucket, Zugriff nur über serverseitig erzeugte signierte URLs.
- **DSGVO:** Supabase-Projekt in **EU-Region** + AVV mit Supabase; Einwilligungen versioniert
  mit Zeitstempel; Speicher- und Löschkonzept (personenbezogene Daten der Vorgänge z. B. 24
  Monate nach Abschluss, danach Anonymisierung); IBAN/Steuer-ID nur serverseitig, nie in
  Analytics/Tracking; Tracking (`tracking.ts`) bleibt auf der öffentlichen Landingpage und wird
  **nicht** in die Kunden-Journey übernommen.
- **Subventionsrecht:** explizite Bestätigungs-Checkboxen mit § 264 StGB-Hinweis bei De-minimis
  und vor Absenden.

---

## 7. UX- & Wording-Leitplanken (ISO 9241-110 Grundsätze)

- Ein Schritt = eine Fragestellung; Fortschrittsbalken mit benannten Etappen.
- Klare, handlungsorientierte Titel („Ihr Unternehmen“, „De-minimis-Erklärung“, nicht
  „Schritt 4/7“).
- Jedes Fachfeld mit „Warum fragen wir das?“-Erklärung (Muster aus dem bestehenden KMU-Check
  beibehalten).
- Live-Nutzen: Förderquote und geschätzter Zuschuss in € von Schritt 0 an sichtbar.
- Fehler tolerant: Zwischenspeichern, zurückspringen, keine Datenverluste; Validierung erst
  beim Weiterklicken mit klaren Meldungen.
- Barrierefreiheit: WCAG-Kontraste (bestehende Tokens), Fokus-Ringe, Tastaturbedienbarkeit,
  `prefers-reduced-motion` – alles bereits Projektkonvention.
- Empfehlungs-Design: Eskalator-Concierge-Option als hervorgehobene, vorausgewählte Karte mit
  Nutzenargumenten („Wir übernehmen Antrag, Rückfragen und Verwendungsnachweis“).

---

## 8. Umsetzungsplan (Meilensteine)

| # | Meilenstein | Inhalt | Ergebnis |
|---|---|---|---|
| M0 | Vorbereitung | Supabase-Projekt (EU) anlegen, Env-Variablen, Better-Auth-Setup, deklaratives DB-Schema + Migrationen, generierte TS-Typen (`supabase gen types`), `supabase db advisors` grün, Lint-Config reparieren (bekannter Fehler: zirkuläre ESLint-9/FlatCompat-Struktur) | Login lauffähig, Schema deployed |
| M1 | Admin-Portal | Angebot anlegen mit **PDF-Upload + Gemini-Extraktion** (Entwurf → Vertrieb bestätigt), Token-Link erzeugen, Dashboard mit Status, Einladungs-E-Mail | Vertrieb kann Kunden einladen |
| M2 | Journey-Gerüst | Wizard-Shell unter `/v/[token]`, Token-Validierung, Zwischenspeichern, Schritte 0–2 + 5 (Stammdaten, Ansprechpartner, Antragsdaten/Bank) | Stammdaten vollständig erfassbar |
| M3 | KMU im Portal | Bestehende `kmu.ts`-Engine + Live-Evaluation als Journey-Schritt, 2-Geschäftsjahre-Erfassung, **openregister-Vorbefüllung** (Stammdaten, Gesellschafter/Holdings mit Quoten, Finanzkennzahlen – als bestätigbare Vorschläge), Snapshot in DB | KMU-Status & Förderquote im Vorgang |
| M4 | De-minimis | `lib/deminimis.ts`, Beihilfen-Tabelle, Live-Summe/Restbudget, Erklärungs-Checkboxen | De-minimis-Erklärung komplett |
| M5 | Vollmacht & Abschluss | Beantragungsweg-Wahl, Vollmachts-PDF-Generator, Signatur-Canvas/Upload, Dossier-PDF, n8n-Übergabe, Bestätigungsseite | End-to-End-Prozess lauffähig |
| M6 | Härtung | Security-Review (Headers, Rate-Limits, Token-Flüsse), DSGVO-Texte, Löschkonzept, manuelle fachliche Prüfung der De-minimis-/KMU-Logik gegen Quellen (wie bei kmu.ts dokumentiert), responsive/UI-Feinschliff | Produktionsreife |

Verifikation je Meilenstein: `npm run build` + (reparierter) `npm run lint`; fachliche Logik
über dokumentierte Edge-Case-Prüfungen (Muster aus README).

---

## 9. Offene Entscheidungen (bitte abstimmen)

1. **Vollmachtstext:** Wer liefert den juristisch geprüften Wortlaut (Eskalator AG?)?
   Ich baue einen Platzhalter mit klar gekennnzeichnetem Mustertext.
2. **Beantragungsweg „selbst“:** Braucht es dann überhaupt eine Vollmacht, oder endet die
   Journey mit dem Dossier-Download + Übergabe der Daten an den Kunden?
3. **E-Mail-Versand:** Resend-Account vorhanden, oder erstmal nur „Link kopieren“ im Admin?
4. **Eskalator-Rolle (Phase 2):** Soll die Eskalator AG später selbst einloggen und Vorgänge
   sehen/bearbeiten? (Das Schema ist darauf vorbereitet, würde die RLS-/Guard-Logik erweitern.)
5. **Supabase:** Du legst das Projekt an – bitte EU-Region (Frankfurt) wählen; ich übernehme
   dann Keys/Setup in `.env.local`.
6. **Kennzahlen-Jahre:** Das n8n-Formular fragt 2024 + 2025 fest ab. Im Portal mache ich die
   Geschäftsjahre dynamisch (letzte zwei abgeschlossene Jahre) – einverstanden?

---

## 10. Recherche: E-Mail (Resend) & Registerdaten (openregister.de)

Verifiziert am 31.08.2026 – gegen offizielle Doku und live gegen die APIs mit unserem Key.

### 10.1 Resend – was die API kann (für uns relevant)

| Funktion | Nutzen für das Portal |
|---|---|
| `emails.send` (HTML oder React-Email) | Aktuell genutzt: Einladung, Eingangsbestätigung, PW-Reset, Willkommen |
| **Templates API** (`template: { id, variables }`) | Möglicher Ausbau: Templates zentral in Resend pflegen statt im Code (`{{{VAR}}}`-Syntax, Fallback-Werte) |
| **Batch-Versand** (`batch.send`, bis 100 Mails/Call) | Später: mehrere Kunden gleichzeitig einladen |
| **Webhooks** (Svix-signiert: `email.delivered`, `email.bounced`, `email.complained`, `email.opened`) | Zustellstatus in `uebergaben`/Audit spiegeln; Bounces im Admin-Dashboard markieren („E-Mail nicht zustellbar – Link per Telefon durchgeben") |
| **Scheduling** (`scheduledAt`) + **Idempotency-Key** | Erinnerungs-Mail „Link läuft ab" nach z. B. 60 Tagen; doppelter Versand sicher verhindert |
| **Tags** | Jede Mail mit `angebot_nr` taggen → Zustellstatistik pro Vorgang |
| **Inbound/Receiving** | Antworten der Kunden auf Portal-Mails empfangen (z. B. an mabe@automatisieren.io) |

Absender: `MABE Förderportal <mabe@automatisieren.io>` (Code-Default; Domain `automatisieren.io`
muss in Resend verifiziert sein, sonst Zustellfehler – geloggt, nie blockierend).

### 10.2 openregister.de – verifizierte Endpunkte (live getestet)

Auth: `Authorization: Bearer <key>`, Basis `https://api.openregister.de`. **Geldwerte in Cents.**
`company_id` immer aus der Suche übernehmen, niemals selbst zusammenbauen.

| Endpunkt | Credits | Gelieferte Daten (live verifiziert) |
|---|---|---|
| `GET /v1/autocomplete/company?query=…` | 1 | Name, `company_id`, Adresse (straße/plz/ort), Rechtsform, `register_court/_number/_type`, `active`, Unternehmenszweck |
| `GET /v1/company/{id}` | 10 | Stammdaten komplett: Historie (Namen/Adressen), Stammkapital, **`industry_codes` (WZ 2025)**, Geschäftsführung (`representation` mit Rolle + Geburtsdatum), Register-Daten, Dokumentenliste (Gesellschafterliste, Satzung als abrufbare PDFs) |
| `GET /v1/company/{id}/financials` | ~10 | Jahreswerte: `employees`, `revenue`, `balance_sheet_total`, `equity`, `net_income` u. v. m. pro Bilanzstichtag (`date`) |
| `GET /v1/company/{id}/owners` | ~10 | Gesellschafter mit **`percentage_share`** (direkt als Zahl!), `nominal_share`, natürliche/juristische Person, Quellen-PDF (Gesellschafterliste) |
| `GET /v1/company/{id}/holdings` | ~10 | Beteiligungen der Firma an anderen (für Verbund „abwärts") |
| Dokumente (im Detail-Response verlinkt) | – | Gesellschafterliste/Satzung als PDF (signierte S3-URL, 30 min gültig) |

### 10.3 Prefill-Konzept (M3, „maximal assistiert")

Ziel: Der Kunde tippt nur seinen Firmennamen – das Portal füllt vor und der Kunde **bestätigt** statt zu tippen.

1. **Schritt „Ihr Unternehmen":** Suchfeld (Autocomplete, 1 Credit/Suche) → Auswahl trifft
   `company_id`. Dann Details + Financials + Owners + Holdings laden (~40 Credits ≈ Cent-Beträge)
   und als **editierbare Vorbefüllung** einsetzen:
   - Stammdaten: Name, Straße/PLZ/Ort, Land, Rechtsform (→ `personenart`), Unternehmenszweck,
     **WZ-Code** (Achtung: API liefert WZ **2025**, Formular fragt WZ **2008** – Mapping nötig
     oder als Vorschlag mit Hinweis „bitte prüfen"), Registergericht/-nummer (Zusatzinfo)
   - KMU-Schritt: `employees` → JAE-Vorschlag, `revenue` → Umsatz, `balance_sheet_total`
     → Bilanzsumme (jeweils **Cents → EUR umrechnen!**, Stichtag als `geschaeftsjahr`)
   - Verbund: `owners` (percentage_share ≥ 25 → „hält Anteile an uns") und `holdings`
     (≥ 25 → „wir halten Anteile daran") direkt als Beteiligungs-Zeilen mit Quote;
     deren Financials können bei Bedarf nachgeladen werden
2. **Vertrauens-UX:** Jeder vorbefüllte Block bekommt Badge „aus dem Handelsregister
   (openregister.de), Stand <Datum>" + Bleibt-editierbar-Hinweis; Roh-Response als
   `register_snapshot` (JSONB) in `stammdaten` speichern (Nachvollziehbarkeit, Caching
   gegen doppelte Credit-Kosten).
3. **Kosten-/Fehlerbild:** Suche nichts gefunden / inaktive Firma / keine Financials →
   manuelles Formular wie bisher. 401/402/429/5xx siehe Doku (Retry mit Backoff bei 429).
4. **Später:** Dokumenten-Download (Gesellschafterliste) direkt ans Dossier hängen;
   `signals`/Monitoring ist nur über handelsregister.ai relevant (anderer Anbieter),
   openregister deckt unseren Bedarf voll ab.
