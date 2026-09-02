-- 24 · Verbund-Kennzahlen je Geschäftsjahr
--
-- Das BAFA-Portal fragt für den KMU-Nachweis die Kennzahlen der letzten zwei
-- abgeschlossenen Geschäftsjahre ab (2025 UND 2024) – auch für Partner- und
-- verbundene Unternehmen. Bisher hatte jede Beteiligung nur EINEN jahreslosen
-- Kennzahlensatz; derselbe Wert wurde für beide Jahre in die Verbundrechnung
-- gelegt (latente Falschverrechnung, actions.ts).
--
-- Struktur (Zod-Spiegel: beteiligungJahrSchema in src/lib/journey/schemas.ts):
--   kennzahlen = [
--     {"geschaeftsjahr": 2025, "jae": 12, "umsatz": 3400000, "bilanzsumme": 2100000},
--     {"geschaeftsjahr": 2024, "jae": 11, "umsatz": 3100000, "bilanzsumme": 1950000}
--   ]
--
-- Die Skalarspalten jae/umsatz/bilanzsumme bleiben bestehen und werden beim
-- Schreiben mit dem NEUSTEN BAFA-Jahr befüllt – alle Bestandsleser (Dossier,
-- Fallakte, Kundenkonto, Zusammenfassungs-PDF) zeigen damit weiterhin sinnvolle
-- Werte, ohne angefasst werden zu müssen. jahresvolle Quelle ist kennzahlen.
--
-- Kein Index: kennzahlen wird nie durchsucht/gefiltert, nur zeilenweise gelesen.
-- Bewusst KEIN Backfill der 13 Bestandszeilen: Ohne kennzahlen bleiben die
-- Skalarspalten massgeblich (jahreKennzahl-Fallback in verbund-jahre.ts) –
-- ein Backfall haette dieselben Zahlen fuer beide Jahre „erfunden".
alter table beteiligungen
  add column if not exists kennzahlen jsonb;

comment on column beteiligungen.kennzahlen is
  'Kennzahlen je Geschäftsjahr [{geschaeftsjahr, jae, umsatz, bilanzsumme}] – BAFA: letzte zwei abgeschlossene Jahre; Skalarspalten = neuestes Jahr (Kompatibilitäts-Fallback für Alt-Bestände ohne kennzahlen)';
