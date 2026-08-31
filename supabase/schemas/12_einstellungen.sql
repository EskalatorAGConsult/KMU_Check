-- Migration 12 · Einstellungen (Admin-konfigurierbare Werte, z. B. Webhook-URL)
-- Zugriff ausschließlich serverseitig via Service-Role (Deny-by-default wie alle Tabellen).

create table einstellungen (
  schluessel       text primary key,
  wert             text not null,
  aktualisiert_von text references "user"(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table einstellungen is 'Admin-Einstellungen (z. B. webhook_url); DB-Wert hat Vorrang vor ENV-Fallback';

-- updated_at-Trigger (Funktion aus Migration 05 wiederverwenden)
create trigger einstellungen_updated_at before update on einstellungen
  for each row execute function set_updated_at();

alter table einstellungen enable row level security;
revoke all on einstellungen from anon, authenticated;

-- FK-Spalte indexieren (Advisor-Regel: jeder FK hat einen Index)
create index einstellungen_aktualisiert_von_idx on einstellungen(aktualisiert_von);
