/**
 * Sicherheitsnetz gegen Test-/Platzhalter-Empfaenger.
 *
 * Reine Funktion ohne Framework-Abhaengigkeit (voll testbar). Wird in der
 * EINZIGEN Versand-Stelle (`sendeMail` in notify.ts) geprueft, bevor Resend
 * aufgerufen wird – so kann keine Testadresse eine echte Mail ausloesen,
 * egal welcher Fachprozess sie ausloest.
 *
 * Gesperrt sind:
 * - typische Test-/Platzhalter-Domains (test.de, example.*, Wegwerf-Anbieter)
 * - reservierte TLDs (.invalid, .test, .example, .local, .localhost)
 * - Adressen ohne gueltige Domain (kaputte Eingabe -> nicht senden)
 */

const GESPERRTE_DOMAINS = new Set([
  'test.de',
  'example.com',
  'example.org',
  'example.net',
  'mailinator.com',
  'maildrop.cc',
  'yopmail.com',
])

const GESPERRTE_TLD_ENDUNGEN = ['.invalid', '.test', '.example', '.localhost', '.local']

export function istTestAdresse(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  if (!domain || !domain.includes('.')) return true
  if (GESPERRTE_DOMAINS.has(domain)) return true
  return GESPERRTE_TLD_ENDUNGEN.some((endung) => domain.endsWith(endung))
}
