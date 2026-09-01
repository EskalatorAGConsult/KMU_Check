'use client'

import { useEffect } from 'react'

import { FehlerAnzeige } from '@/components/fehler/fehler-anzeige'
import { loggeFehler } from '@/lib/fehler'

/**
 * Error-Boundary der Kunden-Journey (/v/[token]). Laienverstaendlich:
 * die bisherigen Eingaben sind serverseitig zwischengespeichert und gehen
 * durch einen erneuten Versuch nicht verloren.
 */
export default function JourneyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    loggeFehler('journey', error, { digest: error.digest })
  }, [error])

  return (
    <FehlerAnzeige
      titel="Ihr Förderprojekt konnte gerade nicht geladen werden."
      text="Keine Sorge: Ihre bisherigen Angaben sind sicher gespeichert und gehen nicht verloren. Laden Sie die Seite einfach erneut – bei anhaltenden Problemen hilft Ihnen Ihr MABE-Ansprechpartner sofort weiter."
      kennung={error.digest}
      onReset={reset}
      homeHref="/"
      homeLabel="Zur Startseite"
    />
  )
}
