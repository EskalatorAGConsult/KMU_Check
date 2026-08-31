-- 07 · Journey-Fortschritt (Draft-Speicherung: Kunden koennen pausieren & fortsetzen)
-- Die fachlichen Tabellen (stammdaten, beteiligungen, ...) werden erst beim
-- finalen Absenden aus den validierten Entwuerfen befuellt. Der Entwurf selbst
-- ist ein JSONB-Dokument pro Schritt – dadurch sind Klickstrecken-Aenderungen
-- (neue/umgestellte Schritte) ohne DB-Migration moeglich.

create table journey_fortschritt (
  angebot_id        uuid primary key references angebote(id) on delete cascade,
  aktueller_schritt text not null,
  schritte          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table journey_fortschritt is 'Entwurfsdaten der Kunden-Journey je Schritt (JSONB), ermoeglicht Speichern & Fortsetzen';

create trigger t_journey_fortschritt_updated
  before update on journey_fortschritt
  for each row execute function set_updated_at();

alter table journey_fortschritt enable row level security;
revoke all on journey_fortschritt from anon, authenticated;
