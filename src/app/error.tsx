'use client'

import { useEffect } from 'react'

import { FehlerAnzeige } from '@/components/fehler/fehler-anzeige'
import { loggeFehler } from '@/lib/fehler'

/**
 * App-weite Error-Boundary (faengt Fehler aller Seiten ohne eigene Boundary).
 * Zeigt eine markenkonsistente Fehlerseite mit Reset statt der
 * Next.js-Standardfehlerseite; der Fehler wird strukturiert geloggt.
 */
export default function GlobalAppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    loggeFehler('app', error, { digest: error.digest })
  }, [error])

  return (
    <FehlerAnzeige
      titel="Etwas ist schiefgelaufen."
      text="Beim Laden dieser Seite ist ein unerwarteter Fehler aufgetreten. Ihre bisherigen Eingaben sind nicht verloren – versuchen Sie es einfach erneut."
      kennung={error.digest}
      onReset={reset}
      homeHref="/"
      homeLabel="Zur Startseite"
    />
  )
}
