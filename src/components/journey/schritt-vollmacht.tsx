'use client'

import { EskalatorBlock } from './eskalator-block'
import { SignaturPad } from './signatur-pad'
import { Checkbox, Feld, inputCls } from './ui'

/**
 * Vollmacht & Beantragungsweg. Eskalator-Concierge ist die empfohlene
 * (visuell hervorgehobene) Option; die Online-Unterschrift erfolgt als
 * gezeichnete Signatur (Canvas, eIDAS einfache elektronische Signatur)
 * zusaetzlich zum getippten Namen als Unterzeichner-Nachweis – Zeitpunkt,
 * IP und User-Agent werden serverseitig protokolliert.
 */
export function SchrittVollmacht({
  daten,
  fehler,
  onChange,
}: {
  daten: Record<string, unknown>
  fehler: Record<string, string>
  onChange: (name: string, wert: unknown) => void
}) {
  const weg = (daten.beantragungsweg as string | undefined) ?? 'eskalator'

  const karte = (
    wert: 'eskalator' | 'selbst',
    titel: string,
    beschreibung: string,
    empfohlen: boolean,
  ) => {
    const aktiv = weg === wert
    return (
      <button
        type="button"
        onClick={() => onChange('beantragungsweg', wert)}
        aria-pressed={aktiv}
        className={`relative flex flex-col gap-2 rounded-2xl border-2 p-5 text-left transition-colors ${
          aktiv ? 'border-teal-600 bg-teal-50/60' : 'border-olive-200 bg-white hover:border-teal-400'
        }`}
      >
        {empfohlen && (
          <span className="absolute -top-3 left-4 rounded-full bg-teal-600 px-2.5 py-0.5 text-xs font-semibold text-white">
            Empfohlen
          </span>
        )}
        <span className="text-base font-semibold text-mabe-900">{titel}</span>
        <span className="text-sm/6 text-olive-600">{beschreibung}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {karte(
          'eskalator',
          'Beantragung durch den Fördermittel-Concierge der Eskalator AG',
          'Die Eskalator AG stellt den Antrag in Ihrem Namen, beantwortet Rückfragen der Bewilligungsstelle und begleitet Sie bis zur Bewilligung. Dafür erteilen Sie eine digitale Vollmacht.',
          true,
        )}
        {karte(
          'selbst',
          'Beantragung durch unser Unternehmen selbst',
          'Sie erhalten Ihr vollständiges Antrags-Dossier zum Download und stellen den Antrag eigenständig im FZD-Portal. Hinweis: Für das Portal ist ein ELSTER-Organisationszertifikat erforderlich.',
          false,
        )}
      </div>
      {fehler.beantragungsweg && <p className="text-xs/5 font-medium text-red-700">{fehler.beantragungsweg}</p>}

      {weg === 'eskalator' && (
        <div className="flex flex-col gap-4">
          <EskalatorBlock />
          <div className="flex flex-col gap-4 rounded-2xl border border-olive-200 bg-olive-50/50 p-5">
            <h3 className="text-sm font-semibold text-mabe-900">
              Vollmacht nach § 14 VwVfG
              <span className="ml-2 text-xs font-normal text-olive-500">
                Original · BAFA-Formular eew_vm_3
              </span>
            </h3>
            <p className="text-sm/6 text-olive-700">
              Mit Ihrer Unterschrift bestellen Sie die <strong>Eskalator AG</strong> als bevollmächtigte
              Organisation im Sinne des § 14 VwVfG gegenüber dem Bundesamt für Wirtschaft und Ausfuhrkontrolle
              (BAFA). Maßgeblich ist ausschließlich das folgende <strong>Original-Formular des BAFA</strong> –
              lesen Sie es hier direkt durch:
            </p>

            {/* Original-Formular eingebettet (Desktop); mobil oeffnet es in einem eigenen Tab,
                weil iOS/Android PDFs in iframes nicht zuverlaessig darstellen. */}
            <iframe
              src="/vorlagen/eew_vm_3.pdf#view=FitH"
              title="BAFA-Vollmacht – offizielles Formular eew_vm_3"
              className="hidden h-[36rem] w-full rounded-xl bg-white ring-1 ring-olive-200 sm:block"
            />
            <a
              href="/vorlagen/eew_vm_3.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-teal-600 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50"
            >
              Vollmacht-Formular öffnen (PDF, 2 Seiten) ↗
            </a>

            <p className="rounded-xl bg-white px-4 py-3 text-xs/5 text-olive-600 ring-1 ring-olive-200">
              Nach dem Absenden erstellen wir automatisch das <strong>ausgefüllte</strong> BAFA-Formular
              eew_vm_3 mit Ihren Stammdaten und Ihrer Unterschrift – Sie finden es in Ihrem Kundenkonto unter
              „Das reichen wir für Sie ein“.
            </p>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-mabe-900">
              Unterschrift zeichnen <span className="text-teal-700">*</span>
            </span>
            <SignaturPad
              wert={(daten.signatur_png as string | null) ?? null}
              fehler={fehler.signatur_png}
              onChange={(dataUrl) => onChange('signatur_png', dataUrl ?? undefined)}
            />
          </div>

          <Feld
            label="Unterzeichner/in (vollständiger Name)"
            hilfe="Name der zeichnungsberechtigten Person – ergänzt die gezeichnete Unterschrift als Nachweis. Zeitpunkt und technische Daten werden protokolliert."
            fehler={fehler.unterschrift_name}
            pflicht
          >
            <input
              className={inputCls}
              placeholder="Vorname Nachname"
              autoComplete="name"
              value={(daten.unterschrift_name as string) ?? ''}
              onChange={(e) => onChange('unterschrift_name', e.target.value)}
            />
          </Feld>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Checkbox
          checked={(daten.vorhaben_nicht_begonnen as boolean) ?? false}
          onChange={(v) => onChange('vorhaben_nicht_begonnen', v)}
          fehler={fehler.vorhaben_nicht_begonnen}
          label={
            <>
              <strong>Bestätigung Vorhabenbeginn:</strong> Wir haben mit der Maßnahme noch nicht begonnen – keine
              Bestellung, kein Liefervertrag, keine Ausführung. (Ein vorzeitiger Beginn führt zum Förderausschluss.)
            </>
          }
        />
        <Checkbox
          checked={(daten.wahrheitsgemaess as boolean) ?? false}
          onChange={(v) => onChange('wahrheitsgemaess', v)}
          fehler={fehler.wahrheitsgemaess}
          label="Ich bestätige, dass alle Angaben in diesem Vorgang wahrheitsgemäß und vollständig sind."
        />
        <Checkbox
          checked={(daten.dsgvo as boolean) ?? false}
          onChange={(v) => onChange('dsgvo', v)}
          fehler={fehler.dsgvo}
          label={
            <>
              <strong>Datenschutz:</strong> Ich willige ein, dass meine Angaben zur Erstellung und Abwicklung des
              Förderantrags verarbeitet und – bei Beantragung durch die Eskalator AG – an diese übermittelt werden
              (Art. 6 Abs. 1 lit. a DSGVO). Widerruf jederzeit möglich.
            </>
          }
        />
      </div>
    </div>
  )
}
