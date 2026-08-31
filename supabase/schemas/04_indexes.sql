-- 04 · Indizes
-- Regel: jeder Fremdschlüssel bekommt einen Index; Partial Indexes auf Hot Paths.

-- Admin-Dashboard: offene Vorgänge (status-Filter), Neueste zuerst
create index angebote_status_idx on angebote (status)
  where status not in ('abgeschlossen', 'widerrufen');
create index angebote_angelegt_von_idx on angebote (angelegt_von);
create index angebote_created_idx on angebote (created_at desc);

-- Token-Lookup: ausschließlich ueber den Hash, nur aktive Tokens
create index journey_tokens_hash_idx on journey_tokens (token_hash)
  where revoked_at is null;
create index journey_tokens_angebot_idx on journey_tokens (angebot_id);

-- FK-Indizes der Detail-Tabellen
create index beteiligungen_angebot_idx on beteiligungen (angebot_id);
create index kmu_bewertungen_angebot_idx on kmu_bewertungen (angebot_id);
create index deminimis_beihilfen_angebot_idx on deminimis_beihilfen (angebot_id);
create index dokumente_angebot_idx on dokumente (angebot_id);
create index uebergaben_angebot_idx on uebergaben (angebot_id);
create index audit_events_angebot_idx on audit_events (angebot_id, created_at desc);
