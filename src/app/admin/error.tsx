'use client'

import { useEffect } from 'react'

import { FehlerAnzeige } from '@/components/fehler/fehler-anzeige'
import { loggeFehler } from '@/lib/fehler'

/** Error-Boundary des Admin-Bereichs (Vertrieb/Eskalator). */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    loggeFehler('admin', error, { digest: error.digest })
  }, [error])

  return (
    <FehlerAnzeige
      titel="Der Admin-Bereich konnte nicht geladen werden."
      text="Beim Abruf der Daten ist ein Fehler aufgetreten (z. B. Datenbank kurzzeitig nicht erreichbar). Versuchen Sie es erneut – bestehende Daten sind davon nicht betroffen."
      kennung={error.digest}
      onReset={reset}
      homeHref="/admin"
      homeLabel="Zur Vorgangsübersicht"
    />
  )
}
