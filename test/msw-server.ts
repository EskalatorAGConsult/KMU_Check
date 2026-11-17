import { afterEach } from 'vitest'

import { setupServer } from 'msw/node'

/**
 * MSW v2 (Mock Service Worker) fuer Vitest: faengt alle HTTP-Anfragen auf
 * Node-Fetch-Ebene ab – Netzwerkgrenzen (OpenRegister, Gemini, Resend,
 * Lead-Webhook) werden deterministisch getestet, ohne echte Credits oder
 * Keys zu verbrauchen (SOTA-Directive: Verification over Assumption).
 *
 * Policy 'warn': die Bestandssuite bleibt unveraendert (reine Unit-Tests
 * triggern keine Requests). Die MSW-Suiten registrieren ihre Handler
 * explizit per server.use() und behaupten Antworten/Call-Counts.
 */
export const server = setupServer()

server.listen({ onUnhandledRequest: 'warn' })

// Isolation: Handler und Lifetime-Events zwischen den Tests zuruecksetzen.
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
})
