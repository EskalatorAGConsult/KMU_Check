-- Migration 27 · Status 'archiviert' für abgeschlossene Vorgänge
--
-- Erlaubt das leichte Archivieren fertiger Vorgänge direkt in der
-- Admin-Listenansicht (ohne die Fallakte zu öffnen). Archivierte
-- Vorgänge verschwinden aus der Standard-Ansicht und sind über einen
-- Filter wieder einblendbar. Reaktivierung ist möglich.

alter type angebot_status add value if not exists 'archiviert';
