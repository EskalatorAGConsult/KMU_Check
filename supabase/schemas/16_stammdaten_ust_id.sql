-- Migration 16 · USt-IdNr. des Antragstellers (juristische Personen)
-- Wird beim BAFA-Antrag (Modul 3) abgefragt; Vorbefuellung moeglich aus der
-- Gemini-Angebotsanalyse bzw. kuenftig aus OpenRegister (vat_id).
alter table stammdaten
  add column if not exists ust_id text;

comment on column stammdaten.ust_id is 'Umsatzsteuer-Identifikationsnummer (z. B. DE123456789), optional';
