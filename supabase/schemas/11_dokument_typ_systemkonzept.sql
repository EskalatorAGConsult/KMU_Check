-- Migration 11 · dokument_typ um 'systemkonzept' erweitern
-- Fuer das automatisch generierte MABE-Systemkonzept (BAFA Modul 3, Merkblatt EEW Kap. 3.1).
alter type dokument_typ add value if not exists 'systemkonzept';
