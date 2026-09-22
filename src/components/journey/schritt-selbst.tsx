import type { Angebot } from '@/lib/db/types'

/**
 * „Selbst einreichen" – die eigene Seite fuer Kund:innen, die den Antrag
 * selbst beim BAFA stellen. Kein Portal-Formular: klare Checkliste der
 * benoetigten Daten, Download der Unterlagen (Systemkonzept, Angebot) in
 * kleinen PDF-Rahmen und der direkte Weg zum BAFA-Antragsformular.
 *
 * Fakten (BAFA-Merkblatt EEW): Antrag ausschliesslich elektronisch ueber
 * https://fms.bafa.de/BafaFrame/eew; ELSTER-Organisationszertifikat zwingend.
 */

const BEREITHALTEN = [
  ['Stammdaten Ihres Unternehmens', 'Name, Anschrift, WZ-Code (2008), Steuernummer, ggf. USt-IdNr.'],
  ['KMU-Kennzahlen 2025 UND 2024', 'Beschäftigte (JAE), Jahresumsatz und Bilanzsumme – je Geschäftsjahr, inklusive aller verbundenen Unternehmen'],
  ['De-minimis-Beihilfen der letzten 3 Jahre', 'Beihilfegeber, Betrag, Bewilligungsdatum (Bestandteil des Antragsformulars)'],
  ['Bankverbindung für die Auszahlung', 'Kontoinhaber (meist die Firma) + IBAN'],
  ['Standort der Maßnahme', 'Wo wird die Technik installiert? (falls abweichend von der Firmenadresse)'],
] as const

function PdfRahmen({
  titel,
  hinweis,
  href,
  vorschau,
}: {
  titel: string
  hinweis: string
  href: string
  /** Inline-Vorschau im PDF-Rahmen (nur Desktop). */
  vorschau?: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-olive-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-200" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-mabe-900">{titel}</p>
          <p className="text-xs/5 text-olive-600">{hinweis}</p>
        </div>
      </div>
      {vorschau && (
        <iframe
          src={`${href}#view=FitH`}
          title={`Vorschau: ${titel}`}
          className="hidden h-56 w-full rounded-xl bg-olive-50 ring-1 ring-olive-200 sm:block"
        />
      )}
      <a
        href={href}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-mabe-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-mabe-800"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
          <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.69L6.7 8.9a.75.75 0 1 0-1.06 1.06l3.75 3.75c.3.3.77.3 1.06 0l3.75-3.75a.75.75 0 1 0-1.06-1.06l-2.54 2.54V2.75Z" />
          <path d="M3.5 12.75a.75.75 0 0 1 .75.75v2.75c0 .414.336.75.75.75h10a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 1 1.5 0v2.75A2.25 2.25 0 0 1 15 18.5H5a2.25 2.25 0 0 1-2.25-2.25V13.5a.75.75 0 0 1 .75-.75Z" />
        </svg>
        PDF herunterladen
      </a>
    </div>
  )
}

export function SchrittSelbst({ angebot, token }: { angebot: Angebot; token: string }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Schrittfolge der Selbst-Einreichung */}
      <ol className="flex flex-col gap-2.5">
        {(
          [
            ['Unterlagen herunterladen', 'Systemkonzept und Ihr MABE-Angebot (unten) – beides brauchen Sie für den Antrag.'],
            ['Daten aus der Checkliste bereithalten', 'Alles Wichtige steht in der Liste unten – so sitzen Sie nur einmal am Formular.'],
            ['Im BAFA-Portal einreichen', 'Antrag nur online möglich – Sie brauchen ein ELSTER-Organisationszertifikat (Beantragung dauert Wochen!).'],
          ] as const
        ).map(([titel, text], i) => (
          <li key={titel} className="flex gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-olive-200">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-mabe-900 text-xs font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-mabe-900">{titel}</p>
              <p className="mt-0.5 text-xs/5 text-olive-600">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Unterlagen im PDF-Rahmen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PdfRahmen
          titel="Systemkonzept (Pflichtanlage Modul 3)"
          hinweis="Datenerfassungsplan MABE smart control – dieses Dokument müssen Sie zwingend hochladen."
          href="/vorlagen/systemkonzept.pdf"
          vorschau
        />
        <PdfRahmen
          titel={`Ihr MABE-Angebot ${angebot.angebot_nr}`}
          hinweis="Kostenangebot mit den Investitionskosten – das BAFA verlangt es als Beleg."
          href={`/v/${token}/angebot.pdf`}
        />
      </div>

      {/* Checkliste */}
      <div className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-mabe-900">Diese Daten bereithalten (Checkliste)</h3>
        <ul className="mt-3 flex flex-col gap-3">
          {BEREITHALTEN.map(([titel, text]) => (
            <li key={titel} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white" aria-hidden>
                ✓
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-mabe-900">{titel}</p>
                <p className="text-xs/5 text-olive-600">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* BAFA-Portal */}
      <div className="flex flex-col gap-3 rounded-2xl bg-mabe-900 p-5 text-white sm:p-6">
        <p className="text-sm font-semibold">Einreichen beim BAFA</p>
        <p className="text-sm/6 text-olive-200">
          Das elektronische Antragsformular für Modul 3 finden Sie im BAFA-Portal. Für die Anmeldung brauchen Sie
          ein <strong className="text-white">ELSTER-Organisationszertifikat</strong> – beantragen Sie es frühzeitig,
          die Ausstellung dauert mehrere Wochen.
        </p>
        <a
          href="https://fms.bafa.de/BafaFrame/eew"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
        >
          Zum BAFA-Antragsformular (fms.bafa.de) ↗
        </a>
      </div>

      <p className="text-xs/5 text-olive-500">
        Fragen zur Einreichung? Ihr MABE-Ansprechpartner hilft gern weiter – oder wechseln Sie oben zurück zur
        Beantragung durch unser Fördermittel-Team (kostenlos).
      </p>
    </div>
  )
}
