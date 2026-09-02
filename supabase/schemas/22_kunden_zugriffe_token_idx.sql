-- Migration 22 · Fehlender FK-Index kunden_zugriffe.token_id
-- Befund aus scripts/db-verify.mjs: der FK kunden_zugriffe.token_id ->
-- journey_tokens(id) hatte keinen Index. Bei Token-Loeschung/-Widerruf
-- (z. B. DSGVO-Loeschung, Token-Rotation) wuerde Postgres die
-- Zugriffstabelle sequentiell scannen.

create index if not exists kunden_zugriffe_token_idx on kunden_zugriffe (token_id);
