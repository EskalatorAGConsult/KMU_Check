-- Migration 22 · WZ-Code: einbuchstabige Abschnitte (A-U) erlauben
-- Die Klassifikation der Wirtschaftszweige 2008 (Destatis) kennt Abschnitts-
-- buchstaben ("C" = Verarbeitendes Gewerbe) – die App-Validierung
-- (src/lib/validierung.ts, pruefeWzCode) akzeptiert sie folgerichtig.
-- Der bisherige CHECK ^[0-9A-Z.\-]{2,10}$ wies einbuchstabige Abschnitte
-- zurueck und liess den Stammdaten-Insert mit rohem DB-Fehler scheitern.
alter table stammdaten drop constraint if exists stammdaten_wz_code_check;
alter table stammdaten
  add constraint stammdaten_wz_code_check check (wz_code ~ '^[0-9A-Z.\-]{1,10}$');
