'use client'

import { Checkbox, Feld, inputCls } from './ui'

/**
 * Vollmacht & Beantragungsweg. Eskalator-Concierge ist die empfohlene
 * (visuell hervorgehobene) Option; die Online-Unterschrift erfolgt v1 als
 * getippter vollstaendiger Name (einfache elektronische Signatur, eIDAS),
 * mit Nachweis ueber Zeitpunkt/IP/User-Agent serverseitig.
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
        <div className="flex flex-col gap-4 rounded-2xl border border-olive-200 bg-olive-50/50 p-5">
          <h3 className="text-sm font-semibold text-mabe-900">Vollmacht</h3>
          <p className="text-sm/6 text-olive-700">
            Ich bevollmächtige die <strong>Eskalator AG</strong>, für das in diesem Vorgang beschriebene Vorhaben
            (BAFA EEW, Modul 3) den Förderantrag in meinem Namen zu stellen, mit der Bewilligungsstelle zu
            kommunizieren, Unterlagen nachzureichen und Bescheide entgegenzunehmen. Die Vollmacht gilt bis zum
            Abschluss des Verfahrens und kann jederzeit schriftlich widerrufen werden.
          </p>
          <Feld
            label="Online-Unterschrift (vollständiger Name)"
            hilfe="Rechtswirksam als einfache elektronische Signatur. Zeitpunkt und technische Daten werden protokolliert."
            fehler={fehler.unterschrift_name}
            pflicht
          >
            <input
              className={inputCls}
              placeholder="Vorname Nachname"
              value={(daten.unterschrift_name as string) ?? ''}
              onChange={(e) => onChange('unterschrift_name', e.target.value)}
            />
          </Feld>
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
