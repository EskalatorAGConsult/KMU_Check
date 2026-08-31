-- 01 · Erweiterungen
-- pgcrypto: digest() fuer Token-Hashes (SHA-256); gen_random_uuid() ist ab PG13 eingebaut,
-- pgcrypto wird fuer digest gebraucht.
create extension if not exists pgcrypto;
-- citext: case-insensitive E-Mail-Vergleiche
create extension if not exists citext;
