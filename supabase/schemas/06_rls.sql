-- 06 · Row-Level Security & Rechte (Deny-by-default)
-- Datenzugriff ausschließlich serverseitig via Service-Role (bypassed RLS).
-- anon/authenticated bekommen nichts; Policies werden erst ergänzt, wenn
-- künftige Rollen (z. B. Eskalator-Login) direkt lesen duerfen.

alter table angebote               enable row level security;
alter table journey_tokens         enable row level security;
alter table stammdaten             enable row level security;
alter table beteiligungen          enable row level security;
alter table kmu_bewertungen        enable row level security;
alter table deminimis_beihilfen    enable row level security;
alter table deminimis_erklaerungen enable row level security;
alter table vollmachten            enable row level security;
alter table dokumente              enable row level security;
alter table uebergaben             enable row level security;
alter table audit_events           enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- Audit-Log und Uebergaben sind append-only: auch serverseitig kein UPDATE/DELETE
-- (Anwendung schreibt nur INSERT; Korrekturen erfolgen durch neue Events).
