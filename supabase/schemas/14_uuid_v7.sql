-- Migration 14 · UUIDv7 (RFC 9562) als Default fuer alle eigenen ID-Spalten
-- Bisher: gen_random_uuid() = UUIDv4 (rein zufaellig, schlechte Index-Lokalitaet
-- und keine Zeit-Sortierung). Neu: uuid_v7() – 48 Bit Unix-ms + Zufall,
-- zeitlich sortierbar (B-Tree-freundlich), Format bleibt uuid (16 Byte).
-- Postgres 17.6 hat noch kein natives uuidv7() (kommt in PG18) – eigene Funktion.
-- Bestehende Zeilen behalten ihre v4-IDs (gemischt ist gueltig; nur Defaults wechseln).
-- Better-Auth-IDs ("user".id, text, nanoid) und Journey-/Einladungs-Token
-- (base64url-Geheimnisse, keine IDs) bleiben bewusst unveraendert.

create or replace function uuid_v7() returns uuid
language plpgsql volatile
as $func$
declare
  ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  b  bytea;
begin
  -- 48 Bit Zeitstempel (ms) + 80 Bit Zufall; dann Version/Variante setzen
  b := substring(int8send(ms) from 3 for 6) || gen_random_bytes(10);
  b := set_byte(b, 6, (get_byte(b, 6) & 15) | 112);  -- Version 7 (0x70)
  b := set_byte(b, 8, (get_byte(b, 8) & 63) | 128);  -- Variante 10 (RFC 9562)
  return encode(b, 'hex')::uuid;
end
$func$;
comment on function uuid_v7() is 'UUIDv7 (RFC 9562): zeit-sortierte IDs; ab PG18 durch natives uuidv7() ersetzbar';

alter table angebote              alter column id set default uuid_v7();
alter table journey_tokens        alter column id set default uuid_v7();
alter table beteiligungen         alter column id set default uuid_v7();
alter table kmu_bewertungen       alter column id set default uuid_v7();
alter table deminimis_beihilfen   alter column id set default uuid_v7();
alter table dokumente             alter column id set default uuid_v7();
alter table uebergaben            alter column id set default uuid_v7();
-- audit_events.id bleibt bigint identity (append-only Log, bereits streng monoton)
alter table angebot_zugriffe      alter column id set default uuid_v7();
alter table benutzer_einladungen  alter column id set default uuid_v7();
