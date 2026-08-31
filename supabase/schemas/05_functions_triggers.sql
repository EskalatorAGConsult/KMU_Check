-- 05 · Funktionen & Trigger
-- Zentrale updated_at-Funktion (SECURITY INVOKER = Default; kein SECURITY DEFINER noetig).

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger t_angebote_updated
  before update on angebote
  for each row execute function set_updated_at();

create trigger t_stammdaten_updated
  before update on stammdaten
  for each row execute function set_updated_at();
