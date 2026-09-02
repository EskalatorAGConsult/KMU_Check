'use client'

import { useState } from 'react'

/**
 * Anbieter-Block im Vollmacht-Schritt: WissensReich Academy UG als operative
 * Gesellschaft und bevollmaechtigte Organisation (§ 14 VwVfG). Logo
 * (public/logos/wissensreich.svg, sonst Wortmarke als Fallback) und kurze
 * Vita; der Foerdermittel-Concierge uebernimmt den gesamten Behoerdenteil.
 */
export function EskalatorBlock() {
  const [logoFehlt, setLogoFehlt] = useState(false)

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-4">
        {logoFehlt ? (
          // Fallback-Wortmarke, solange keine Logodatei hinterlegt ist
          <span className="flex h-12 items-center rounded-xl bg-mabe-900 px-4 text-base font-bold tracking-wide text-white">
            Wissens<span className="ml-1.5 text-xs font-medium text-teal-300">ACADEMY</span>
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- optionales Markenlogo, bewusst ohne next/image
          <img
            src="/logos/wissensreich.svg"
            alt="Logo der WissensReich Academy UG"
            className="h-12 w-auto"
            onError={() => setLogoFehlt(true)}
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-mabe-900">WissensReich Academy UG (haftungsbeschränkt)</p>
          <p className="text-xs/5 text-olive-500">Ihr Fördermittel-Partner</p>
          <p className="text-xs/5 text-olive-500">Weinsbergstraße 190 · 50825 Köln</p>
          <p className="text-xs/5 text-olive-500">Ihr Ansprechpartner: Florian Domin</p>
        </div>
      </div>

      <p className="text-sm/6 text-olive-700">
        Die WissensReich Academy begleitet Unternehmen durch den gesamten Fördermittel-Prozess – von der ersten
        Prüfung über die Antragstellung bis zur Bewilligung. Ihr{' '}
        <strong className="text-mabe-900">Fördermittel-Concierge</strong> übernimmt dabei die komplette
        Kommunikation mit der Bewilligungsstelle: Antrag einreichen, Rückfragen beantworten, Unterlagen
        nachreichen, Bescheid entgegennehmen.
      </p>

      <div className="rounded-xl bg-olive-50 px-4 py-3 text-xs/5 text-olive-600">
        <p>
          Deutsche Gesellschaft (Geschäftsführer: Hermann Fürstenau &amp; Florian Domin ·{' '}
          info@wissensreich.academy) – als bevollmächtigte Organisation nach § 14 VwVfG reicht sie Ihren Antrag
          beim BAFA ein.
        </p>
        <p className="mt-1.5">
          Rechtliche Angaben (Impressum, Datenschutz) finden Sie im Fussbereich dieser Seite.
        </p>
      </div>
    </div>
  )
}
