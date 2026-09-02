'use client'

import { useState } from 'react'

/**
 * Anbieter-Block der Eskalator AG im Vollmacht-Schritt:
 * Logo (public/logos/eskalator.svg, sonst Wortmarke als Fallback),
 * kurze Vita und der Hinweis auf die operative Abwicklung durch die
 * WissensReich Academy GmbH, Muelheim an der Ruhr.
 */
export function EskalatorBlock() {
  const [logoFehlt, setLogoFehlt] = useState(false)

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-4">
        {logoFehlt ? (
          // Fallback-Wortmarke, solange keine Logodatei hinterlegt ist
          <span className="flex h-12 items-center rounded-xl bg-mabe-900 px-4 text-base font-bold tracking-wide text-white">
            ESKALATOR<span className="ml-1.5 text-xs font-medium text-teal-300">AG</span>
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- optionales Markenlogo, bewusst ohne next/image
          <img
            src="/logos/eskalator.svg"
            alt="Logo der Eskalator AG"
            className="h-12 w-auto"
            onError={() => setLogoFehlt(true)}
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-mabe-900">Eskalator AG</p>
          <p className="text-xs/5 text-olive-500">Ihre Fördermittelspezialisten</p>
          <p className="text-xs/5 text-olive-500">Churerstrasse 135 · 8808 Freienbach · Schweiz</p>
          <p className="text-xs/5 text-olive-500">Ihre Ansprechpartnerin: Antonja Brücker</p>
        </div>
      </div>

      <p className="text-sm/6 text-olive-700">
        Die Eskalator AG begleitet Unternehmen durch den gesamten Fördermittel-Dschungel – von der ersten Prüfung
        über die Antragstellung bis zur Bewilligung. Ihr <strong className="text-mabe-900">Fördermittel-Concierge</strong>{' '}
        übernimmt dabei die komplette Kommunikation mit der Bewilligungsstelle: Antrag einreichen, Rückfragen
        beantworten, Unterlagen nachreichen, Bescheid entgegennehmen.
      </p>

      <div className="rounded-xl bg-olive-50 px-4 py-3 text-xs/5 text-olive-600">
        <p>
          Die <strong className="text-mabe-900">operative Abwicklung</strong> Ihres Antrags erfolgt durch die{' '}
          <strong className="text-mabe-900">WissensReich Academy UG (haftungsbeschränkt)</strong>, Weinsbergstraße
          190, 50825 Köln (Geschäftsführer: Hermann Fürstenau &amp; Florian Domin · info@wissensreich.academy) – einer
          deutschen Gesellschaft, an der die Eskalator AG beteiligt ist und mit der sie in Kooperation arbeitet.
        </p>
        <p className="mt-1.5">
          Rechtliche Angaben (Impressum, Datenschutz) finden Sie im Fussbereich dieser Seite.
        </p>
      </div>
    </div>
  )
}
