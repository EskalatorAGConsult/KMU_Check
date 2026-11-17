-- Migration 26 · Fristen-Erinnerungen (Reminder-Log)
--
-- Konfigurierbare Vorlauf-Zeiten (Admin-Einstellungen, Tabelle einstellungen):
--   frist_erinnerung_zeitraum_tage  (Standard 14) – vor Ende des Durchführungszeitraums
--   frist_erinnerung_vnw_tage       (Standard 28) – vor der VNW-Vorlagefrist
-- Versand: täglich via Vercel Cron (/api/cron/fristen) oder Manuell-Button
-- in den Admin-Einstellungen; Mail an die Lead-Empfänger (Resend, best effort).
--
-- Diese Tabelle macht den Versand IDEMPOTENT: ein Unique-Key aus Vorgang,
-- Art und Frist-Datum garantiert, dass jede Frist genau EINMAL erinnert wird
-- (Insert mit ON CONFLICT DO NOTHING; nur ein neuer Zeile loest eine Mail aus).
-- Frist-Datum im Key: aendert sich die Frist (z. B. Verlaengerung), darf erneut
-- erinnert werden. Nach Einreichung des VNW entfaellt die vnw_frist-Erinnerung
-- (Domäne), bereits gesendete Zeilen bleiben als Nachweis.

create type frist_erinnerung_art as enum ('zeitraum_ende', 'vnw_frist');

create table frist_erinnerungen (
  id          uuid primary key default uuid_v7(),
  angebot_id  uuid not null references angebote(id) on delete cascade,
  art         frist_erinnerung_art not null,
  frist_am    date not null,
  gesendet_am timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (angebot_id, art, frist_am)
);
comment on table frist_erinnerungen is 'Versand-Nachweis der Fristen-Erinnerungen (idempotent je Vorgang/Art/Frist;(unique) verhindert Doppel-Mails)';

create index frist_erinnerungen_angebot_idx on frist_erinnerungen (angebot_id, created_at desc);

alter table frist_erinnerungen enable row level security;
revoke all on frist_erinnerungen from anon, authenticated;
