-- Migration 21 · Interne Notizen & Wiedervorlage (Berater-Arbeitsplatz)
-- Freitext-Notizen der Admins zu einem Vorgang (Telefonate, Absprachen,
-- fehlende Unterlagen) mit optionalem Wiedervorlage-Datum. Append-only
-- Historie; loeschbar nur via Kaskade mit dem Vorgang (DSGVO-Loeschung).

create table vorgang_notizen (
  id               uuid primary key default uuid_v7(),
  angebot_id       uuid not null references angebote(id) on delete cascade,
  -- Better-Auth-User-ID des verfassenden Admins (text, nanoid – wie "user".id)
  autor            text not null,
  text             text not null check (char_length(text) between 1 and 2000),
  -- Optionales Wiedervorlage-Datum (Berater-Workflow: „Steuernummer kommt bis …")
  wiedervorlage_am date,
  created_at       timestamptz not null default now()
);
comment on table vorgang_notizen is 'Interne Berater-Notizen je Vorgang inkl. optionaler Wiedervorlage (nur Admins)';

create index vorgang_notizen_angebot_idx on vorgang_notizen (angebot_id, created_at desc);
create index vorgang_notizen_wiedervorlage_idx on vorgang_notizen (wiedervorlage_am)
  where wiedervorlage_am is not null;

-- RLS aktivieren: kein direkter Client-Zugriff; Lesen/Schreiben laeuft
-- ausschliesslich ueber die Service-Role-Repositories (Admin-guarded).
alter table vorgang_notizen enable row level security;
