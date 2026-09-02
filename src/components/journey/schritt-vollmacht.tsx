'use client'

import { useEffect, useState, useTransition } from 'react'

import { ladeVollmachtUploadHoch } from '@/lib/journey/actions'
import { EskalatorBlock } from './eskalator-block'
import { SignaturPad } from './signatur-pad'
import { Checkbox, Feld, inputCls } from './ui'

/**
 * Vollmacht & Beantragungsweg. Eskalator-Concierge ist die empfohlene
 * (visuell hervorgehobene) Option. Zwei Signatur-Wege (signatur_modus):
 * - 'canvas': online zeichnen (eIDAS einfache elektronische Signatur)
 * - 'upload': Vordruck laden -> haendisch unterschreiben -> scannen ->
 *   hochladen (das Dokument ist dann selbst die Vollmacht)
 * Zeitpunkt, IP und User-Agent werden serverseitig protokolliert.
 */
export function SchrittVollmacht({
  daten,
  fehler,
  onChange,
  token,
  nameVorschlag,
}: {
  daten: Record<string, unknown>
  fehler: Record<string, string>
  onChange: (name: string, wert: unknown) => void
  /** Journey-Token (fuer den Vordruck-Download und den Upload). */
  token: string
  /** Vorschlag fuer den Unterzeichner-Namen (Ansprechpartner aus der Journey). */
  nameVorschlag?: string
}) {
  const weg = (daten.beantragungsweg as string | undefined) ?? 'eskalator'
  const uploadPfad = (daten.vollmacht_upload_pfad as string | undefined) ?? null
  const [modus, setModus] = useState<'canvas' | 'upload'>(uploadPfad ? 'upload' : 'canvas')
  const [uploadMeldung, setUploadMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  // Smart Default: Unterzeichner-Name aus dem Ansprechpartner-Schritt
  // vorbefuellen (nur wenn leer; ueberschreibt nie eine eigene Eingabe).
  // Verzoegert hinter die Hydration (kein setState direkt im Effekt).
  useEffect(() => {
    if (!nameVorschlag || daten.unterschrift_name) return
    const frame = requestAnimationFrame(() => onChange('unterschrift_name', nameVorschlag))
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmalig beim Mount; spaetere eigene Eingaben gewinnen
  }, [])

  const waehleModus = (m: 'canvas' | 'upload') => {
    setModus(m)
    setUploadMeldung(null)
    // Datenkonsistenz: pro Vorgang nur EIN Signatur-Nachweis – beim Wechsel
    // wird der jeweils andere verworfen (kein versteckter Restwert).
    if (m === 'canvas') onChange('vollmacht_upload_pfad', undefined)
    else onChange('signatur_png', undefined)
  }

  const hochladen = (datei: File) => {
    setUploadMeldung(null)
    const fd = new FormData()
    fd.set('datei', datei)
    startTransition(async () => {
      const res = await ladeVollmachtUploadHoch(token, fd)
      if (res.ok) {
        onChange('vollmacht_upload_pfad', res.pfad)
        setUploadMeldung({ art: 'ok', text: `„${datei.name}“ wurde hochgeladen und Ihrem Vorgang zugeordnet.` })
      } else {
        setUploadMeldung({ art: 'fehler', text: res.fehler })
      }
    })
  }

  const karte = (
    wert: 'eskalator' | 'selbst',
    titel: string,
    beschreibung: string,
    badges: { label: string; cls: string }[],
  ) => {
    const aktiv = weg === wert
    return (
      <button
        type="button"
        onClick={() => onChange('beantragungsweg', wert)}
        aria-pressed={aktiv}
        className={`relative flex flex-col gap-2 rounded-2xl border-2 p-5 pt-6 text-left transition-colors ${
          aktiv ? 'border-teal-600 bg-teal-50/60' : 'border-olive-200 bg-white hover:border-teal-400'
        }`}
      >
        {badges.length > 0 && (
          <span className="absolute -top-3 left-4 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span key={b.label} className={`rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ${b.cls}`}>
                {b.label}
              </span>
            ))}
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
          'Die Eskalator AG stellt den Antrag in Ihrem Namen, beantwortet Rückfragen der Bewilligungsstelle und begleitet Sie bis zur Bewilligung – für Sie völlig kostenlos. Dafür erteilen Sie eine digitale Vollmacht.',
          [
            { label: '⭐ Unsere Empfehlung', cls: 'bg-teal-600 text-white' },
            { label: 'KOSTENLOS', cls: 'bg-amber-400 text-mabe-900 ring-1 ring-amber-500' },
          ],
        )}
        {karte(
          'selbst',
          'Beantragung durch unser Unternehmen selbst',
          'Sie erhalten Ihr vollständiges Antrags-Dossier zum Download und stellen den Antrag eigenständig im FZD-Portal. Hinweis: Für das Portal ist ein ELSTER-Organisationszertifikat erforderlich.',
          [],
        )}
      </div>
      {fehler.beantragungsweg && <p className="text-xs/5 font-medium text-red-700">{fehler.beantragungsweg}</p>}

      {/* Vergleich auf einen Blick: informierte statt „verkaufte" Entscheidung */}
      <div className="overflow-x-auto rounded-2xl border border-olive-200 bg-white">
        <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-olive-50 text-xs text-olive-500">
              <th className="px-4 py-2.5 font-semibold"></th>
              <th className="px-4 py-2.5 font-semibold text-teal-800">Eskalator-Concierge ⭐</th>
              <th className="px-4 py-2.5 font-semibold text-olive-600">Selbst beantragen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive-100 text-sm">
            {(
              [
                ['Wer stellt den Antrag im BAFA-Portal?', 'Wir – komplett für Sie', 'Sie selbst (ELSTER-Zertifikat nötig)'],
                ['Wer beantwortet Rückfragen der Behörde?', 'Wir – bis zur Bewilligung', 'Sie selbst'],
                ['Kosten für Sie', '0 € (kostenlos)', '0 €, aber Ihr Zeitaufwand'],
                ['Ihr Aufwand', 'Unterschrift – fertig', 'Portal-Anmeldung + komplette Antragstellung'],
              ] as const
            ).map(([frage, eskalator, selbst]) => (
              <tr key={frage}>
                <th className="px-4 py-2.5 font-medium text-mabe-900">{frage}</th>
                <td className="px-4 py-2.5 text-teal-800">
                  <span className="mr-1.5 text-teal-600" aria-hidden>✓</span>
                  {eskalator}
                </td>
                <td className="px-4 py-2.5 text-olive-600">{selbst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {weg === 'eskalator' && (
        <div className="flex flex-col gap-4">
          <EskalatorBlock />

          {/* Signatur-Modus waehlen: online zeichnen ODER haendisch */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-olive-200 bg-olive-50/50 p-1.5" role="tablist" aria-label="Wie möchten Sie unterschreiben?">
            <button
              type="button"
              role="tab"
              aria-selected={modus === 'canvas'}
              onClick={() => waehleModus('canvas')}
              className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                modus === 'canvas' ? 'bg-white text-mabe-900 shadow-sm ring-1 ring-olive-200' : 'text-olive-500 hover:text-mabe-900'
              }`}
            >
              💻 Online unterschreiben
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modus === 'upload'}
              onClick={() => waehleModus('upload')}
              className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                modus === 'upload' ? 'bg-white text-mabe-900 shadow-sm ring-1 ring-olive-200' : 'text-olive-500 hover:text-mabe-900'
              }`}
            >
              🖊 Händisch unterschreiben
            </button>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-olive-200 bg-olive-50/50 p-5">
            <h3 className="text-sm font-semibold text-mabe-900">
              Vollmacht nach § 14 VwVfG
              <span className="ml-2 text-xs font-normal text-olive-500">
                Original · BAFA-Formular eew_vm_3
              </span>
            </h3>
            <p className="text-sm/6 text-olive-700">
              Mit Ihrer Unterschrift bestellen Sie die <strong>WissensReich Academy UG (haftungsbeschränkt)</strong>,
              Weinsbergstraße 190, 50825 Köln, als bevollmächtigte Organisation im Sinne des § 14 VwVfG gegenüber
              dem Bundesamt für Wirtschaft und Ausfuhrkontrolle (BAFA). Die WissensReich Academy UG arbeitet in
              Kooperation mit der <strong>Eskalator AG</strong>, die an ihr beteiligt ist. Maßgeblich ist
              ausschließlich das folgende <strong>Original-Formular des BAFA</strong> – es ist bereits mit Ihren
              Daten vorbefüllt, prüfen Sie es direkt hier:
            </p>

            {/* Vorbefuelltes Formular eingebettet (Desktop): token-geschuetzte Route
                fuellt die Reisedaten aus dem Journey-Entwurf live ein. Mobil oeffnet
                der Link in einem eigenen Tab (iOS/Android zeigen iframe-PDFs unsicher). */}
            <iframe
              src={`/v/${token}/vollmacht-vordruck.pdf?inline=1#view=FitH`}
              title="BAFA-Vollmacht eew_vm_3 – vorbefüllt mit Ihren Daten"
              className="hidden h-[36rem] w-full rounded-xl bg-white ring-1 ring-olive-200 sm:block"
            />
            <a
              href={`/v/${token}/vollmacht-vordruck.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-teal-600 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50"
            >
              Vorbefülltes Vollmacht-Formular öffnen (PDF, 2 Seiten) ↗
            </a>

            {modus === 'canvas' ? (
              <>
                <p className="rounded-xl bg-white px-4 py-3 text-xs/5 text-olive-600 ring-1 ring-olive-200">
                  Nach dem Absenden erstellen wir automatisch das <strong>ausgefüllte</strong> BAFA-Formular
                  eew_vm_3 mit Ihren Stammdaten und Ihrer Unterschrift – Sie finden es in Ihrem Kundenkonto unter
                  „Das reichen wir für Sie ein“.
                </p>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-mabe-900">
                    Unterschrift zeichnen <span className="text-teal-700">*</span>
                  </span>
                  <p className="text-xs/5 text-olive-600">
                    Unterschreiben Sie mit dem Finger oder der Maus – so wie auf Ihrem Ausweis. Ihre Unterschrift wird
                    zusammen mit Name und Datum an der vorgesehenen Stelle des BAFA-Formulars eingefügt (Vorschau im
                    Dokument oben).
                  </p>
                  <SignaturPad
                    wert={(daten.signatur_png as string | null) ?? null}
                    fehler={fehler.signatur_png}
                    onChange={(dataUrl) => onChange('signatur_png', dataUrl ?? undefined)}
                  />
                </div>

                <Feld
                  label="Unterzeichner/in (vollständiger Name)"
                  hilfe="Name der zeichnungsberechtigten Person (vorbefüllt mit Ihrem Ansprechpartner – bitte prüfen). Ergänzt die gezeichnete Unterschrift als Nachweis; Zeitpunkt und technische Daten werden protokolliert."
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
              </>
            ) : (
              <div className="flex flex-col gap-4">
                {/* 4-Schritte-Anleitung fuer die haendische Signatur */}
                <ol className="flex flex-col gap-2.5">
                  {(
                    [
                      ['Vordruck herunterladen', 'Das BAFA-Formular ist bereits mit Ihren Daten vorbefüllt – nur Datum und Unterschrift sind frei.'],
                      ['Ausdrucken & unterschreiben', 'Bitte wie auf Ihrem Ausweis – mit Ort und Datum.'],
                      ['Einscannen oder abfotografieren', 'PDF, PNG oder JPG genügt – gut lesbar.'],
                      ['Hier hochladen', 'Wir ordnen die signierte Vollmacht Ihrem Vorgang zu und reichen sie ein.'],
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

                <a
                  href={`/v/${token}/vollmacht-vordruck.pdf`}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mabe-900 px-5 py-3 text-sm font-semibold text-white hover:bg-mabe-800"
                >
                  ⬇ Vordruck herunterladen (vorbefüllt, ohne Unterschrift)
                </a>

                {/* Upload der signierten Datei */}
                {uploadPfad ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-600/30 bg-teal-50 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="animate-check-pop flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden>
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-teal-900">Signierte Vollmacht hochgeladen</p>
                        <p className="truncate font-mono text-[11px] text-teal-700">{uploadPfad.split('/').pop()}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <label className="cursor-pointer rounded-lg border border-teal-600 bg-white px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50">
                        Ersetzen
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="sr-only"
                          disabled={pending}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) hochladen(f)
                            e.target.value = ''
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onChange('vollmacht_upload_pfad', undefined)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-600/50 bg-white px-5 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 ${
                      pending ? 'pointer-events-none opacity-60' : ''
                    }`}
                  >
                    {pending ? 'Lädt hoch …' : '⬆ Signierte Vollmacht hochladen (PDF, PNG oder JPG · max. 15 MB)'}
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="sr-only"
                      disabled={pending}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) hochladen(f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
                {uploadMeldung && (
                  <p
                    role="status"
                    className={`rounded-lg px-3 py-2 text-xs font-medium ${
                      uploadMeldung.art === 'ok' ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {uploadMeldung.text}
                  </p>
                )}
                {fehler.vollmacht_upload_pfad && (
                  <p className="text-xs/5 font-medium text-red-700" role="alert">
                    {fehler.vollmacht_upload_pfad}
                  </p>
                )}
                {fehler.signatur_png && modus === 'upload' && (
                  <p className="text-xs/5 font-medium text-red-700" role="alert">
                    {fehler.signatur_png}
                  </p>
                )}
              </div>
            )}
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
