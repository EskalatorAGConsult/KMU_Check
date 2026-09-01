-- Migration 19 · Admin-Bearbeitung mit Revisionshistorie
-- Admins duerfen Vorgangsdaten korrigieren (Angebot + Stammdaten). Jede
-- Aenderung wird als Diff (alt/neu je Feld) in vorgang_revisionen
-- protokolliert – append-only, loeschbar nur via Kaskade mit dem Vorgang.
-- Zusaetzlich laeuft weiterhin audit_events (sicherheitsrelevante Aktionen);
-- vorgang_revisionen ist die fachliche, feldgenaue Historie fuer die Fallakte.

create table vorgang_revisionen (
  id             uuid primary key default uuid_v7(),
  angebot_id     uuid not null references angebote(id) on delete cascade,
  -- Better-Auth-User-ID des bearbeitenden Admins (text, nanoid – wie "user".id)
  bearbeitet_von text not null,
  bereich        text not null check (bereich in ('angebot', 'stammdaten')),
  -- { "<feld>": { "alt": <wert>, "neu": <wert> }, ... } – nur geaenderte Felder
  aenderungen    jsonb not null check (jsonb_typeof(aenderungen) = 'object'),
  created_at     timestamptz not null default now()
);
comment on table vorgang_revisionen is 'Feldgenaue Aenderungshistorie (Diff alt/neu) adminseitiger Korrekturen an Angebot/Stammdaten';
comment on column vorgang_revisionen.aenderungen is 'JSON-Objekt: Feldname -> {alt, neu}; nur tatsaechlich geaenderte Felder';

create index vorgang_revisionen_angebot_idx on vorgang_revisionen (angebot_id, created_at desc);

-- RLS aktivieren: kein direkter Client-Zugriff; Lesen/Schreiben laeuft
-- ausschliesslich ueber die Service-Role-Repositories (Admin-guarded).
alter table vorgang_revisionen enable row level security;
