'use client'

/**
 * Root-Error-Boundary (faengt Fehler im Root-Layout selbst). Ersetzt das
 * komplette Dokument – daher inline Styles ohne externe Stylesheets, damit
 * die Seite auch dann sauber aussieht, wenn Assets nicht mehr laden.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          backgroundColor: '#ffffff',
          color: '#16324f',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <main style={{ maxWidth: '34rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem' }}>Etwas ist schiefgelaufen.</h1>
          <p style={{ color: '#55637a', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Die Anwendung konnte nicht geladen werden. Bitte versuchen Sie es erneut – bei anhaltenden Problemen
            hilft Ihnen Ihr MABE-Ansprechpartner weiter.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              backgroundColor: '#0d9488',
              color: '#ffffff',
              border: 0,
              borderRadius: '0.75rem',
              padding: '0.75rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Erneut versuchen
          </button>
          {error.digest && (
            <p style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: '#8a94a6' }}>
              Fehlerkennung: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  )
}
