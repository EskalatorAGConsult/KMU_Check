-- Migration 24 · Systemkonzept-Bestaetigung auf der Vollmacht
-- Der Kunde bestaetigt im letzten Journey-Schritt, das universelle
-- Systemkonzept (MABE smart control, Datenerfassungsplan) eingesehen zu
-- haben und dessen Einreichung zuzustimmen. Der Nachweis (Zeitpunkt der
-- Bestaetigung) gehoert zur Vollmacht und damit in die Fallakte.

alter table vollmachten
  add column if not exists systemkonzept_bestaetigt boolean not null default false;

comment on column vollmachten.systemkonzept_bestaetigt is 'Kunde hat das Systemkonzept (Pflichtanlage) in der Journey eingesehen und der Einreichung zugestimmt';
