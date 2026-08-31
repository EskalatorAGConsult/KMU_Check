/**
 * Stammdaten der bevollmaechtigten Organisation fuer die BAFA-Vollmacht
 * (Formular eew_vm_3, Abschnitt 2). Einzige Pflegestelle.
 *
 * TODO(fachlich): Adresse/Telefon der Eskalator AG final bestaetigen lassen –
 * leere Felder werden im ausgefuellten PDF frei gelassen.
 */
export const BEVOLLMAECHTIGTER = {
  name: 'Eskalator AG',
  anrede: '',
  vorname: '',
  nachname: '',
  strasse: '',
  plz: '',
  ort: '',
  telefon: '',
  beraternummer: '',
} as const
