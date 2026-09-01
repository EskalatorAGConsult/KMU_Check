-- Migration 17 · Beteiligungs-Ketten persistieren (Stufe + Pfad)
-- Die Journey erfasst bei OpenRegister-Vorbefuellung die Kettentiefe (stufe)
-- und die letzte Kante der Beteiligungskette (pfad) bereits im Entwurf –
-- bisher gingen diese Angaben beim finalen Insert verloren. Fuer die
-- KMU-Verbundpruefung (EU 2003/361/EG, mehrstufige Beteiligungsketten)
-- und die Admin-Sicht werden sie jetzt dauerhaft gespeichert.
alter table beteiligungen
  add column if not exists stufe integer check (stufe is null or stufe >= 1),
  add column if not exists pfad  text;

comment on column beteiligungen.stufe is 'Kettentiefe der Beteiligung (1 = direkt, 2+ = Folgekette); nur bei OpenRegister-Vorbefuellung gesetzt';
comment on column beteiligungen.pfad  is 'Letzte Kante der Beteiligungskette, z. B. „X GmbH hält 80 % an Y GmbH“';
