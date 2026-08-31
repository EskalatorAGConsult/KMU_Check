-- 09 · FK angebote.angelegt_von -> "user"(id) (Better Auth)
-- Better-Auth-IDs sind TEXT; die bisherige uuid-Spalte wird umgestellt
-- (Tabelle ist zu diesem Zeitpunkt leer).

alter table angebote
  alter column angelegt_von type text;

alter table angebote
  add constraint angebote_angelegt_von_fkey
  foreign key (angelegt_von) references "user"(id) on delete restrict;
