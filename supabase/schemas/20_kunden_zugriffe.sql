-- Migration 20 · Kunden-Zugriffsprotokoll (Login-Log)
-- Protokolliert jeden Aufruf des persoenlichen Journey-Links: wann, wie oft,
-- von welcher IP und mit welchem Geraet/Browser. Dient dem Nachweis gegenueber
-- dem Kunden (wer hatte wann Zugriff) und dem Missbrauchsschutz.
-- Zweckbindung DSGVO: Sicherheits- und Nachweisprotokoll zum Förderverfahren;
-- Zugriff nur ueber Service-Role-Repositories (Admin-guarded), kein Client-Zugriff.

create table kunden_zugriffe (
  id          uuid primary key default uuid_v7(),
  angebot_id  uuid not null references angebote(id) on delete cascade,
  token_id    uuid references journey_tokens(id) on delete set null,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
comment on table kunden_zugriffe is 'Zugriffsprotokoll: Aufrufe des Journey-Links durch den Kunden (Zeit, IP, User-Agent)';

create index kunden_zugriffe_angebot_idx on kunden_zugriffe (angebot_id, created_at desc);

-- RLS aktivieren: kein direkter Client-Zugriff; Lesen/Schreiben laeuft
-- ausschliesslich ueber die Service-Role-Repositories (Admin-guarded).
alter table kunden_zugriffe enable row level security;
