-- 02 · Enum-Typen (Wertebereiche auf DB-Ebene, kein Freitext)
-- Aenderungen an Enums nur ueber ALTER TYPE ... ADD VALUE (append-only).

create type angebot_status as enum (
  'angelegt',        -- vom Vertrieb erfasst, noch nicht versendet
  'eingeladen',      -- Link erzeugt / Einladung verschickt
  'in_bearbeitung',  -- Kunde hat die Journey begonnen
  'eingereicht',     -- Kunde hat abgeschlossen, an Eskalator uebergeben
  'abgeschlossen',   -- Vorgang fertig (Antrag gestellt)
  'widerrufen'       -- Link/Vorgang vom Vertrieb zurueckgezogen
);

create type technologie as enum ('software', 'messtechnik', 'steuerung');

create type software_variante as enum ('mabe_cloud', 'andere', 'offen');

-- Unternehmensart nach EU 2003/361/EG (KMU-Verbundlogik)
create type unternehmensart as enum ('eigenstaendig', 'partner', 'verbunden');

create type personenart as enum ('natuerlich', 'juristisch');

create type gruppenzugehoerigkeit as enum (
  'privat', 'kommunal', 'land', 'freiberuflich', 'contractor'
);

-- Beteiligungsrichtung: abwaerts = wir halten Anteile, aufwaerts = jemand haelt an uns
create type beteiligung_richtung as enum ('abwaerts', 'aufwaerts');

create type kmu_kategorie as enum ('kleinst', 'klein', 'mittel', 'gross');

-- De-minimis nach VO (EU) 2023/2831
create type beihilfe_form as enum ('zuschuss', 'darlehen', 'buergschaft');
create type beihilfe_kategorie as enum ('allgemein', 'agrar', 'fisch');
create type beihilfe_status as enum ('gewaehrt', 'beantragt');

create type beantragungsweg as enum ('selbst', 'eskalator');

create type signatur_modus as enum ('canvas', 'upload');

create type dokument_typ as enum ('angebot_pdf', 'vollmacht', 'dossier', 'upload');
