/**
 * Stammdaten der bevollmaechtigten Organisation fuer die BAFA-Vollmacht
 * (Formular eew_vm_3, Abschnitt 2). Einzige Pflegestelle.
 *
 * Vollmachtnehmer nach § 14 VwVfG: WissensReich Academy UG (haftungsbeschraenkt),
 * Koeln – die deutsche Abwicklungsgesellschaft. Die Eskalator AG (Schweiz) ist
 * an der WissensReich Academy UG beteiligt und arbeitet in Kooperation mit ihr;
 * Marke, Fördermittel-Concierge und Verantwortung bleiben bei der Eskalator AG.
 * Kontaktperson im Formular: Florian Domin (Geschäftsführer).
 */
export const BEVOLLMAECHTIGTER = {
  name: 'WissensReich Academy UG (haftungsbeschränkt)',
  anrede: 'Herr',
  vorname: 'Florian',
  nachname: 'Domin',
  strasse: 'Weinsbergstraße 190',
  plz: '50825',
  ort: 'Köln',
  telefon: '',
  beraternummer: '',
} as const