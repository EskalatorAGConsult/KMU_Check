-- Migration 13 · Benutzer-Einladungen (Userverwaltung mit Einladungslinks)
-- Rollen: 'admin' (MABE), 'eskalator' (Eskalator AG, gleiche Admin-Rechte),
-- 'vertrieb' (MABE-Vertrieb), 'kunde' (öffentliche Registrierung, nicht einladbar),
-- 'deaktiviert' (gesperrtes Konto).
-- Zugriff ausschließlich serverseitig via Service-Role (Deny-by-default).

create table benutzer_einladungen (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  rolle          text not null check (rolle in ('admin', 'eskalator', 'vertrieb')),
  token_hash     bytea not null unique check (octet_length(token_hash) = 32),
  expires_at     timestamptz not null,
  used_at        timestamptz,
  revoked_at     timestamptz,
  eingeladen_von text references "user"(id) on delete set null,
  created_at     timestamptz not null default now()
);
comment on table benutzer_einladungen is 'Einladungslinks fuer Admin-/Vertriebskonten (Token nur als SHA-256-Hash)';

create index benutzer_einladungen_email_idx on benutzer_einladungen(email);
create index benutzer_einladungen_eingeladen_von_idx on benutzer_einladungen(eingeladen_von);

alter table benutzer_einladungen enable row level security;
revoke all on benutzer_einladungen from anon, authenticated;
