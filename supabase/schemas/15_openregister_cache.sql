-- Migration 15 · OpenRegister-Cache (Handelsregister-Verbundabfragen)
-- Jeder Detailabruf kostet API-Credits. Antworten werden daher je company_id
-- fuer 30 Tage gecacht – angebotsuebergreifend (oeffentliche Registerdaten,
-- keine personenbezogenen Kundendaten). Zugriff nur serverseitig via Service-Role.

create table openregister_cache (
  company_id     text primary key,
  payload        jsonb not null,
  abgerufen_at   timestamptz not null default now()
);
comment on table openregister_cache is 'Cache der OpenRegister-Verbundabfragen (Details + Gesellschafter + Beteiligungen), 30 Tage gueltig, spart API-Credits';

alter table openregister_cache enable row level security;
revoke all on openregister_cache from anon, authenticated;

-- Alte Cache-Eintraege schnell finden/bereinigen
create index openregister_cache_abgerufen_idx on openregister_cache(abgerufen_at);
