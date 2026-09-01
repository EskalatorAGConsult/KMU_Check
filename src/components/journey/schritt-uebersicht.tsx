import type { Angebot } from '@/lib/db/types'
import { formatEUR, formatNumber } from '@/lib/kmu'

const TECH_LABEL: Record<string, string> = {
  software: 'Energiemanagementsoftware',
  messtechnik: 'Mess- und Sensortechnik',
  steuerung: 'Steuerungs- und Regelungstechnik',
}

const SOFTWARE_LABEL: Record<string, string> = {
  mabe_cloud: 'MABE Cloud',
  andere: 'Andere Software (wird im Gespräch geklärt)',
  offen: 'Noch offen',
}

/** Schritt 0: „Ihr Förderprojekt auf einen Blick" – Angebot + Rahmendaten. */
export function SchrittUebersicht({ angebot }: { angebot: Angebot }) {
  const investSumme =
    (angebot.invest_software ?? 0) + (angebot.invest_messtechnik ?? 0) + (angebot.invest_steuerung ?? 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Persoenliche Begruessung: der Link ist kundenindividuell */}
      <div className="rounded-2xl border border-teal-600/25 bg-teal-50/50 px-6 py-5">
        <p className="text-base/7 text-mabe-900">
          <strong>Guten Tag{angebot.kunde_ansprechpartner ? ` ${angebot.kunde_ansprechpartner}` : ''},</strong>
        </p>
        <p className="mt-1 text-sm/6 text-olive-700">
          für <strong className="text-mabe-900">{angebot.kunde_firma}</strong> ist alles vorbereitet: Dieses
          Förderprojekt gehört zu Ihrem Angebot <strong>{angebot.angebot_nr}</strong>. Wir führen Sie jetzt durch
          die wenigen Angaben, die wir für Ihren Förderantrag benötigen.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-olive-200 bg-white">
        <div className="border-b border-olive-100 bg-olive-50/60 px-6 py-4">
          <p className="text-xs font-semibold tracking-wide text-olive-500 uppercase">Ihr Angebot</p>
          <p className="mt-1 text-lg font-semibold text-mabe-900">
            {angebot.angebot_nr} · {new Date(angebot.angebot_datum).toLocaleDateString('de-DE')}
          </p>
        </div>
        <dl className="divide-y divide-olive-100 px-6">
          {angebot.technologien.length > 0 && (
            <div className="flex flex-col gap-1 py-4 sm:flex-row sm:justify-between">
              <dt className="text-sm text-olive-600">Technologien</dt>
              <dd className="text-sm font-medium text-mabe-900 sm:text-right">
                {angebot.technologien.map((t) => TECH_LABEL[t] ?? t).join(' · ')}
              </dd>
            </div>
          )}
          {angebot.software_variante && (
            <div className="flex justify-between py-4">
              <dt className="text-sm text-olive-600">Energiemanagementsoftware</dt>
              <dd className="text-sm font-medium text-mabe-900">{SOFTWARE_LABEL[angebot.software_variante]}</dd>
            </div>
          )}
          {angebot.sensoren_gesamt != null && (
            <div className="flex justify-between py-4">
              <dt className="text-sm text-olive-600">Messpunkte / Sensoren</dt>
              <dd className="text-sm font-medium text-mabe-900">
                {formatNumber(angebot.sensoren_gesamt)}
                {angebot.sensoren_prozessbezug != null && ` (davon ${formatNumber(angebot.sensoren_prozessbezug)} mit Prozessbezug)`}
              </dd>
            </div>
          )}
          {investSumme > 0 && (
            <div className="flex justify-between py-4">
              <dt className="text-sm text-olive-600">Investitionskosten (lt. Angebot)</dt>
              <dd className="text-sm font-semibold text-mabe-900">{formatEUR(investSumme)}</dd>
            </div>
          )}
          {angebot.projektende && (
            <div className="flex justify-between py-4">
              <dt className="text-sm text-olive-600">Voraussichtliches Projektende</dt>
              <dd className="text-sm font-medium text-mabe-900">
                {new Date(angebot.projektende).toLocaleDateString('de-DE')}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-2xl bg-mabe-900 p-6 text-white">
        <p className="text-sm/7 text-olive-200">
          Im BAFA-Programm <strong className="text-white">Modul 3</strong> sind für dieses Vorhaben je nach
          KMU-Status <strong className="text-teal-300">bis zu 45 % Zuschuss</strong> möglich
          {investSumme > 0 && (
            <>
              {' '}– bei Ihrem Angebot also bis zu{' '}
              <strong className="text-teal-300">{formatEUR(investSumme * 0.45)}</strong>
            </>
          )}
          . In den nächsten Schritten ermitteln wir Ihre Quote und bereiten alle Antragsdaten vor.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-2 text-sm text-olive-600 sm:grid-cols-3">
        {['ca. 10 Minuten', 'Speichern & später fortfahren möglich', 'Alle Angaben jederzeit korrigierbar'].map((t) => (
          <li key={t} className="flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0 text-teal-600">
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}
