/**
 * Schlichtes In-Memory-Rate-Limit (Fixed Window) fuer oeffentliche
 * Server-Actions – schuetzt kostenpflichtige APIs (OpenRegister) vor
 * Missbrauch durch die oeffentliche Landingpage.
 *
 * Prozess-lokal und bewusst einfach: Auf Vercel gilt das Limit je
 * Serverless-Instanz (weicher Schutz, keine harte Garantie). Fuer den
 * vorliegenden Traffic ausreichend; bei Bedarf spaeter auf eine
 * DB-/Upstash-Variante hebbar, ohne die Aufrufer zu aendern.
 */

interface Fenster {
  start: number
  anzahl: number
}

const fenster = new Map<string, Fenster>()

// Gelegenheitlich abgelaufene Eintraege entsorgen, damit die Map nicht waechst.
function aufraeumen(jetzt: number, windowMs: number) {
  if (fenster.size < 500) return
  for (const [key, f] of fenster) {
    if (jetzt - f.start > windowMs) fenster.delete(key)
  }
}

/**
 * Prueft und zaehlt einen Aufruf. true = erlaubt, false = Limit erreicht.
 * `schluessel` z. B. `suche:203.0.113.7`.
 */
export function rateLimit(schluessel: string, max: number, windowMs: number): boolean {
  const jetzt = Date.now()
  aufraeumen(jetzt, windowMs)
  const f = fenster.get(schluessel)
  if (!f || jetzt - f.start > windowMs) {
    fenster.set(schluessel, { start: jetzt, anzahl: 1 })
    return true
  }
  f.anzahl += 1
  return f.anzahl <= max
}
