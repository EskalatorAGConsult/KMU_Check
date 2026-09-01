-- Migration 18: Bezugsunternehmen je Beteiligungskante
--
-- Hintergrund: Bei Folgeketten (z. B. Holding über Mutter am Antragsteller)
-- bezieht sich die eingetragene Quote nicht zwingend auf den Antragsteller,
-- sondern auf ein Zwischenunternehmen. `bezug` speichert den Namen dieses
-- Bezugsunternehmens; NULL/leer bedeutet „am Antragsteller" (Stufe 1).
-- Die EU-Verrechnung selbst rekonstruiert die Kette daraus (src/lib/kmu.ts).

alter table public.beteiligungen
  add column if not exists bezug text;

comment on column public.beteiligungen.bezug is
  'Bezugsunternehmen der Beteiligungskante (Firmenname). NULL/leer = Antragsteller (Stufe 1).';
