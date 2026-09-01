/**
 * Stammdaten der bevollmaechtigten Organisation fuer die BAFA-Vollmacht
 * (Formular eew_vm_3, Abschnitt 2). Einzige Pflegestelle.
 *
 * Eskalator AG (Schweiz) – Vollmachtnehmer nach § 14 VwVfG.
 * Kontaktperson im Formular: Antonja Brücker.
 * Die operative Abwicklung erfolgt durch die WissensReich Academy GmbH,
 * Muelheim an der Ruhr (Hinweis im Journey-UI, nicht Teil des BAFA-Formulars).
 */
export const BEVOLLMAECHTIGTER = {
  name: 'Eskalator AG',
  anrede: 'Frau',
  vorname: 'Antonja',
  nachname: 'Brücker',
  strasse: 'Churerstrasse 135',
  plz: '8808',
  ort: 'Freienbach (Schweiz)',
  telefon: '',
  beraternummer: '',
} as const
