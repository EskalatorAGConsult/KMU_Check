/**
 * Zentrales Fehler-Handling (framework-frei, client- UND serverseitig).
 * Vertrag fuer alle Bereiche: nutzerlesbare Meldung extrahieren, strukturiert
 * loggen (Sentry-ready: ein einziger Einstiegspunkt, an den spaeter ein
 * Monitoring-Client gehaengt werden kann) – niemals Secrets in Logs.
 */

const FALLBACK = 'Ein unerwarteter Fehler ist aufgetreten.'

/**
 * Nutzerlesbare Fehlermeldung: Error.message, Strings durchgereicht, alles
 * andere auf einen neutralen Fallback. Kuerzt auf 300 Zeichen (Log-/UI-Schutz).
 */
export function fehlerMeldung(e: unknown, fallback = FALLBACK): string {
  let m: string
  if (e instanceof Error) m = e.message
  else if (typeof e === 'string') m = e
  else m = fallback
  m = m.trim()
  if (m === '') m = fallback
  return m.length > 300 ? `${m.slice(0, 299)}…` : m
}

/** Stabile Kurz-Fehlerkennung fuer Support-Rueckfragen (kein Geheimnis). */
export function fehlerKennung(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Strukturiertes Fehler-Logging. `kontext` darf nur nicht-personenbezogene
 * Fachdaten enthalten (IDs, Schritt, Bereich) – keine E-Mails, Tokens, Payloads.
 * Spaeter: hier Sentry/monitoring.captureException ergaenzen (ein Ort).
 */
export function loggeFehler(bereich: string, fehler: unknown, kontext?: Record<string, unknown>): void {
  const eintrag = {
    bereich,
    meldung: fehlerMeldung(fehler),
    stapel: fehler instanceof Error ? (fehler.stack?.split('\n').slice(0, 4).join('\n') ?? null) : null,
    kontext: kontext ?? null,
    zeit: new Date().toISOString(),
  }
  try {
    console.error('[fehler]', JSON.stringify(eintrag))
  } catch {
    // JSON.stringify kann an zirkulaeren Kontexten scheitern – Logging darf
    // selbst nie werfen (Fehlerbehandlung muss ausfallssicher sein).
    console.error('[fehler]', bereich, eintrag.meldung)
  }
}
