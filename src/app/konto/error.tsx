'use client'

import { useEffect } from 'react'

import { FehlerAnzeige } from '@/components/fehler/fehler-anzeige'
import { loggeFehler } from '@/lib/fehler'

/** Error-Boundary des Kundenkontos (/konto). */
export default function KontoError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    loggeFehler('konto', error, { digest: error.digest })
  }, [error])

  return (
    <FehlerAnzeige
      titel="Ihr Kundenkonto konnte nicht geladen werden."
      text="Beim Abruf Ihrer Daten ist ein Fehler aufgetreten. Versuchen Sie es erneut – Ihre gespeicherten Angaben sind davon nicht betroffen."
      kennung={error.digest}
      onReset={reset}
      homeHref="/konto"
      homeLabel="Zum Kundenkonto"
    />
  )
}
