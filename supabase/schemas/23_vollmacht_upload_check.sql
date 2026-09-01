-- Migration 23 · Vollmachten-CHECK: Upload-Modus ohne getippten Namen erlauben
-- Bei signatur_modus = 'upload' ist das hochgeladene, haendisch unterschriebene
-- Dokument selbst der Nachweis; der getippte Name (unterzeichnet_von) wird in
-- diesem Modus nicht erhoben. unterzeichnet_at dokumentiert den Upload-
-- Zeitpunkt (zusaetzlich IP/User-Agent in unterschrift_ip/ua) – der bisherige
-- CHECK wies genau diese Kombination zu Unrecht ab und liess den Abschluss
-- fuer Kunden des Upload-Wegs an der Constraint scheitern.
alter table vollmachten drop constraint if exists vollmachten_check;
alter table vollmachten
  add constraint vollmachten_check
  check (beantragungsweg = 'selbst' or unterzeichnet_at is null or unterzeichnet_von is not null or signatur_modus = 'upload');
