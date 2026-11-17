-- Migration 25 · Bewilligungsbescheid & Verwendungsnachweis (BAFA EEW Modul 3)
--
-- Fachlicher Prozess NACH der Einreichung (Recherchestand 2026-11, BAFA):
--   Antrag (FZD-Onlineportal) -> Zuwendungsbescheid -> Durchfuehrungszeitraum
--   -> Verwendungsnachweis innerhalb der Vorlagefrist laut Bescheid
--     (BAFA-Merkblatt: regelmaessig 3 Monate nach Ablauf des Bewilligungs-
--      zeitraums; Fristversaeumnis kann zum Widerruf fuehren).
--   Die VERBINDLICHE Frist steht im jeweiligen Bescheid – deshalb wird sie
--   per Gemini-OCR ausgelesen und ist jederzeit manuell korrigierbar
--   (NIEMALS geratene Defaults).
--
-- Stationen/Status: angebot_status wird append-only erweitert (Konvention
-- 02_enums) um 'bewilligt' (Bescheid liegt bestätigt vor) und
-- 'vnw_eingereicht' (Verwendungsnachweis komplett übergeben). Bestehende
-- Zeilen/Zustände bleiben unberührt – keine Daten werden gelöscht.
--
-- Aktivierungs-Regel (Anwendung): Existiert eine bescheide-Zeile, sind die
-- Stationen Durchführungszeitraum & Verwendungsnachweis aktiviert.

-- 1 · Enum-Erweiterungen (append-only, IF NOT EXISTS = idempotent)
alter type angebot_status add value if not exists 'bewilligt';
alter type angebot_status add value if not exists 'vnw_eingereicht';

alter type dokument_typ add value if not exists 'bescheid';
alter type dokument_typ add value if not exists 'vnw_beleg';

create type vnw_status as enum ('offen', 'in_bearbeitung', 'eingereicht');
create type vnw_beleg_kategorie as enum ('rechnung', 'zahlungsnachweis', 'sonstiges');

-- 2 · Zuwendungsbescheid (1:1 zum Angebot, Muster wie stammdaten)
create table bescheide (
  angebot_id        uuid primary key references angebote(id) on delete cascade,
  -- Wer hat hochgeladen (Better-Auth-User-ID: Admin oder registrierter Kunde)
  hochgeladen_von   text not null,
  erhalten_am       timestamptz not null default now(),
  -- Felder aus dem Bescheid (OCR-Vorbefüllung, vom Menschen bestaetigt)
  aktenzeichen      text,
  bewilligt_am      date check (bewilligt_am is null or bewilligt_am <= current_date),
  foerderquote_pct  integer check (foerderquote_pct is null or foerderquote_pct in (25, 35, 45)),
  foerdersumme_eur  numeric(14,2) check (foerdersumme_eur is null or foerdersumme_eur >= 0),
  -- Durchführungs-/Bewilligungszeitraum ( editierbar, z. B. Verlängerung)
  durchfuehrung_von date,
  durchfuehrung_bis date,
  -- Vorlagefrist Verwendungsnachweis laut Bescheid (Snapshot, editierbar)
  vnw_frist_am      date,
  -- Gemini-OCR-Rohbefund (Nachvollziehbarkeit wie angebote.extraktion) …
  ocr               jsonb,
  ocr_am            timestamptz,
  -- … und der Moment, in dem ein Mensch die Werte geprüft hat (Pflicht,
  -- bevor der Vorgang als 'bewilligt' geführt wird).
  bestaetigt_am     timestamptz,
  bestaetigt_von    text,
  -- Auflagen/Hinweise aus dem Bescheid (OCR, je Zeile ein Eintrag)
  auflagen          text[],
  notiz             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (durchfuehrung_von is null or durchfuehrung_bis is null
         or durchfuehrung_von <= durchfuehrung_bis),
  -- Frist muss inhaltlich nach der Bewilligung liegen (falls beide bekannt)
  check (vnw_frist_am is null or bewilligt_am is null or vnw_frist_am >= bewilligt_am)
);
comment on table bescheide is 'Zuwendungsbescheid (BAFA EEW): Upload, OCR-Vorbefüllung, bestätigte Bewilligungsdaten, Durchführungszeitraum & VNW-Vorlagefrist';

create trigger t_bescheide_updated
  before update on bescheide
  for each row execute function set_updated_at();

-- 3 · Verwendungsnachweis (1:1, lazy angelegt mit dem ersten Bescheid)
create table verwendungsnachweise (
  angebot_id     uuid primary key references angebote(id) on delete cascade,
  status         vnw_status not null default 'offen',
  -- Snapshot der maßgeblichen Frist (Kopie aus bescheide.vnw_frist_am,
  -- kann abweichen, wenn der Berater sie fachlich korrigiert)
  vorlagefrist_am date,
  sachbericht    text check (sachbericht is null or char_length(sachbericht) <= 8000),
  eingereicht_am timestamptz,
  eingereicht_von text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table verwendungsnachweise is 'Verwendungsnachweis (BAFA): Sachbericht, Belege-Referenzen, Einreichungs-Nachweis (Zeitpunkt, Wer)';

create trigger t_verwendungsnachweise_updated
  before update on verwendungsnachweise
  for each row execute function set_updated_at();

-- 4 · VNW-Belege (n:1): Rechnungen/Zahlungsnachweise als dokumente-Referenz
create table vnw_belege (
  id          uuid primary key default uuid_v7(),
  angebot_id  uuid not null references angebote(id) on delete cascade,
  dokument_id uuid not null references dokumente(id) on delete cascade,
  kategorie   vnw_beleg_kategorie not null default 'rechnung',
  -- Optional erfasster Belegbetrag (netto, EUR) für die Summenansicht
  betrag_eur  numeric(14,2) check (betrag_eur is null or betrag_eur >= 0),
  created_at  timestamptz not null default now()
);
comment on table vnw_belege is 'Einzelne Belege des Verwendungsnachweises (Datei in dokumente, Metadaten hier)';

create index vnw_belege_angebot_idx on vnw_belege (angebot_id, created_at desc);
-- FK-Regel (04_indexes): JEDER Fremdschlüssel bekommt einen Index – auch der
-- Dokument-Bezug (live nachgezogen am 17.11.2026, hier für Replay-Konsistenz).
create index if not exists vnw_belege_dokument_idx on vnw_belege (dokument_id);
create index bescheide_hochgeladen_von_idx on bescheide (hochgeladen_von);

-- 5 · RLS + Rechte (Konvention der Migrationen ab 15: explizit entziehen)
alter table bescheide           enable row level security;
alter table verwendungsnachweise enable row level security;
alter table vnw_belege          enable row level security;

revoke all on bescheide            from anon, authenticated;
revoke all on verwendungsnachweise from anon, authenticated;
revoke all on vnw_belege           from anon, authenticated;
