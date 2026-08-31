-- 10 · Kunden-Zugang: ordnet Better-Auth-Kundenkonten ihre Vorgaenge zu.
-- Ein Kunde kann mehrere Vorgaenge sehen; ein Vorgang kann mehrere Konten
-- haben (z. B. Geschaeftsfuehrung + Energiemanager desselben Unternehmens).

create table if not exists angebot_zugriffe (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references "user"(id) on delete cascade,
  angebot_id  uuid not null references angebote(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, angebot_id)
);

create index if not exists idx_angebot_zugriffe_user on angebot_zugriffe(user_id);
create index if not exists idx_angebot_zugriffe_angebot on angebot_zugriffe(angebot_id);

-- RLS: deny-by-default (Zugriff nur via Service-Role aus Server Actions,
-- nach erfolgter Session-/Token-Pruefung in der Anwendung).
alter table angebot_zugriffe enable row level security;
