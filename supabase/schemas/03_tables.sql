-- 03 · Tabellen
-- Konventionen: uuid-PKs via gen_random_uuid(), timestamptz, not null konsequent,
-- Geldbeträge numeric(14,2) (kein float), Integritaet per FK + CHECK.
--
-- HINWEIS angelegt_von: referenziert spaeter "user"(id) aus Better Auth.
-- Der FK wird mit der Auth-Migration nachgezogen (siehe 07_auth_fk.sql),
-- damit das fachliche Schema unabhaengig deploybar bleibt.

-- Vertriebs-Angebot (vom Admin angelegt, technische Daten ggf. per Gemini aus dem
-- Angebots-PDF extrahiert und vom Vertrieb bestaetigt)
create table angebote (
  id                     uuid primary key default gen_random_uuid(),
  angelegt_von           uuid not null,  -- FK folgt mit Better-Auth-Migration
  status                 angebot_status not null default 'angelegt',
  -- Kunde (minimal; alles Weitere ergaenzt der Kunde in der Journey)
  kunde_firma            text not null check (char_length(kunde_firma) between 2 and 200),
  kunde_ansprechpartner  text,
  kunde_email            citext not null,
  -- Technische Maßnahme (aus dem MABE-Angebot)
  angebot_nr             text not null,
  angebot_datum          date not null,
  technologien           technologie[] not null check (cardinality(technologien) >= 1),
  software_variante      software_variante,
  invest_software        numeric(14,2) check (invest_software >= 0),
  invest_messtechnik     numeric(14,2) check (invest_messtechnik >= 0),
  invest_steuerung       numeric(14,2) check (invest_steuerung >= 0),
  sensoren_gesamt        integer check (sensoren_gesamt >= 0),
  sensoren_prozessbezug  integer check (sensoren_prozessbezug >= 0),
  projektende            date,
  notiz                  text,
  -- Angebots-PDF + Gemini-Extraktion
  angebot_pdf_path       text,
  extraktion             jsonb,
  extrahiert_am          timestamptz,
  extraktion_bestaetigt  boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (sensoren_prozessbezug is null or sensoren_gesamt is null
         or sensoren_prozessbezug <= sensoren_gesamt)
);
comment on table angebote is 'Vertriebs-Angebote (MABE Smart Control), Ausgangspunkt jedes Fördervorgangs';

-- Einladungs-Link: nur SHA-256-Hash, niemals der Klartext-Token
create table journey_tokens (
  id           uuid primary key default gen_random_uuid(),
  angebot_id   uuid not null references angebote(id) on delete cascade,
  token_hash   bytea not null unique check (octet_length(token_hash) = 32),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  check (expires_at > created_at)
);
comment on table journey_tokens is 'Gehashte Einladungs-Links zur Kunden-Journey (klartextfrei)';

-- Kunden-Stammdaten (1:1 zum Angebot; Ziel = Abschnitte 1–5 des Eskalator/n8n-Formulars)
create table stammdaten (
  angebot_id              uuid primary key references angebote(id) on delete cascade,
  unternehmensname        text not null,
  land                    text not null default 'Deutschland',
  plz                     text not null check (plz ~ '^\d{5}$'),
  ort                     text not null,
  strasse                 text not null,
  email                   citext not null,
  wz_code                 text not null check (wz_code ~ '^[0-9A-Z.\-]{2,10}$'),
  unternehmensart         unternehmensart not null,
  vorsteuerabzug          boolean not null,
  personenart             personenart not null,
  geburtsdatum            date,
  steuer_id               text check (steuer_id ~ '^\d{11}$'),
  steuernummer            text,
  ap_rolle                text,
  ap_anrede               text,
  ap_vorname              text,
  ap_nachname             text,
  ap_email                citext,
  gruppenzugehoerigkeit   gruppenzugehoerigkeit not null,
  wirtschaftlich_taetig   boolean not null,
  kontoinhaber            text,
  iban                    text check (iban ~ '^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$'),
  standort_plz            text check (standort_plz ~ '^\d{5}$'),
  standort_ort            text,
  standort_strasse        text,
  vorhaben_nicht_begonnen boolean,
  dsgvo_einwilligung_at   timestamptz,
  -- openregister.de-Vorbefüllung (Cache + Herkunftsnachweis)
  register_company_id     text,
  register_snapshot       jsonb,
  register_abgerufen_am   timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Bedingte Pflicht: natuerliche Person -> Geburtsdatum + Steuer-ID,
  -- juristische Person -> Steuernummer
  check ((personenart = 'natuerlich' and geburtsdatum is not null and steuer_id is not null)
      or (personenart = 'juristisch' and steuernummer is not null))
);
comment on table stammdaten is 'Antragsteller-Stammdaten (Zuwendungsempfänger), 1:1 zum Angebot';

-- Verbund (Partner-/verbundene Unternehmen), n:1 zum Vorgang
create table beteiligungen (
  id            uuid primary key default gen_random_uuid(),
  angebot_id    uuid not null references angebote(id) on delete cascade,
  name          text not null,
  richtung      beteiligung_richtung not null,
  -- < 25 % wird fachlich ignoriert (EU 2003/361/EG) und gar nicht erst gespeichert
  anteil_pct    numeric(5,2) not null check (anteil_pct >= 25 and anteil_pct <= 100),
  jae           numeric(10,2) check (jae >= 0),
  umsatz        numeric(16,2) check (umsatz >= 0),
  bilanzsumme   numeric(16,2) check (bilanzsumme >= 0),
  quelle        text not null default 'manuell' check (quelle in ('manuell', 'openregister')),
  created_at    timestamptz not null default now()
);
comment on table beteiligungen is 'Partner- (25–50 %) und verbundene Unternehmen (> 50 %) für die KMU-Verbundrechnung';

-- KMU-Kennzahlen + Ergebnis-Snapshot (letzte zwei abgeschlossene Geschäftsjahre)
create table kmu_bewertungen (
  id               uuid primary key default gen_random_uuid(),
  angebot_id       uuid not null references angebote(id) on delete cascade,
  geschaeftsjahr   integer not null check (geschaeftsjahr between 2000 and 2100),
  abgeschlossen    boolean not null,
  jae              numeric(10,2) check (jae >= 0),
  umsatz           numeric(16,2) check (umsatz >= 0),
  bilanzsumme      numeric(16,2) check (bilanzsumme >= 0),
  kategorie        kmu_kategorie,
  foerderquote_pct integer check (foerderquote_pct in (25, 35, 45)),
  berechnung       jsonb,  -- vollständiges KmuResult aus src/lib/kmu.ts (Nachvollziehbarkeit)
  created_at       timestamptz not null default now(),
  unique (angebot_id, geschaeftsjahr)
);
comment on table kmu_bewertungen is 'KMU-Kennzahlen je Geschäftsjahr + Ergebnis-Snapshot der kmu.ts-Berechnung';

-- De-minimis: einzelne Beihilfen (rollierender 3-Jahres-Zeitraum, VO (EU) 2023/2831)
create table deminimis_beihilfen (
  id            uuid primary key default gen_random_uuid(),
  angebot_id    uuid not null references angebote(id) on delete cascade,
  beihilfegeber text not null,
  aktenzeichen  text,
  bewilligt_am  date not null check (bewilligt_am <= current_date),
  betrag        numeric(14,2) not null check (betrag >= 0),
  form          beihilfe_form not null,
  kategorie     beihilfe_kategorie not null default 'allgemein',
  status        beihilfe_status not null,
  created_at    timestamptz not null default now()
);
comment on table deminimis_beihilfen is 'Erhaltene/beantragte De-minimis-Beihilfen der letzten 3 Jahre (Höchstbetrag 300.000 €)';

-- De-minimis: die Erklärung selbst (1:1, Snapshot zum Bestätigungszeitpunkt)
create table deminimis_erklaerungen (
  angebot_id     uuid primary key references angebote(id) on delete cascade,
  fusion_3j      boolean not null,
  uebernahme_3j  boolean not null,
  aufspaltung_3j boolean not null,
  summe_eur      numeric(14,2) not null check (summe_eur >= 0),
  bestaetigt_at  timestamptz not null  -- §-264-StGB-Hinweis bestätigt
);
comment on table deminimis_erklaerungen is 'Bestätigte De-minimis-Erklärung inkl. Summen-Snapshot';

-- Beantragungsweg + Vollmacht (1:1)
create table vollmachten (
  angebot_id         uuid primary key references angebote(id) on delete cascade,
  beantragungsweg    beantragungsweg not null,
  signatur_modus     signatur_modus,
  signatur_bild_path text,
  pdf_path           text,
  unterzeichnet_at   timestamptz,
  unterzeichnet_von  text,
  unterschrift_ip    inet,
  unterschrift_ua    text,
  created_at         timestamptz not null default now(),
  -- Vollmachtspflicht nur bei Beantragung durch Eskalator; als Nachweis der
  -- Online-Unterschrift genuegt der getippte Name (+ Zeitpunkt/IP/UA),
  -- das PDF wird daraus generiert (M5) und ist keine Voraussetzung.
  check (beantragungsweg = 'selbst' or unterzeichnet_at is null or unterzeichnet_von is not null)
);
comment on table vollmachten is 'Beantragungsweg-Wahl + Online-Vollmacht (Nachweis: Zeitpunkt, IP, UA)';

-- Dokumente (generierte PDFs, Uploads; Dateien in privatem Storage-Bucket)
create table dokumente (
  id           uuid primary key default gen_random_uuid(),
  angebot_id   uuid not null references angebote(id) on delete cascade,
  typ          dokument_typ not null,
  storage_path text not null unique,
  created_at   timestamptz not null default now()
);
comment on table dokumente is 'Datei-Referenzen (Angebots-PDF, Vollmacht, Dossier, Kunden-Uploads)';

-- Übergabe an Eskalator/n8n (retry-fähig, append-only)
create table uebergaben (
  id          uuid primary key default gen_random_uuid(),
  angebot_id  uuid not null references angebote(id) on delete cascade,
  payload     jsonb not null,
  http_status integer,
  erfolg      boolean not null,
  versucht_at timestamptz not null default now()
);
comment on table uebergaben is 'Webhook-Übergaben an Eskalator/n8n inkl. Antwortstatus (append-only)';

-- Audit-Log (append-only, DSGVO + Nachvollziehbarkeit)
create table audit_events (
  id          bigint generated always as identity primary key,
  angebot_id  uuid references angebote(id) on delete set null,
  actor       text not null,  -- admin:<user-id> | kunde:<token-id> | system
  aktion      text not null,
  details     jsonb,
  created_at  timestamptz not null default now()
);
comment on table audit_events is 'Append-only Audit-Trail aller sicherheitsrelevanten Aktionen';
