'use client'

import Link from 'next/link'
import { useState } from 'react'

import { ladeFallakte } from '@/lib/admin/kunden-actions'
import type { SystemkonzeptVorlage } from '@/lib/admin/systemkonzept-actions'
import type { KundeDetail, KundeUebersicht } from '@/lib/db/repositories/kunden'
import type { AngebotStatus } from '@/lib/db/types'
import { VorgangDatenblatt } from '@/components/admin/vorgang-datenblatt'

/**
 * Kundenuebersicht mit aufklappbarer Fallakte pro Kunde.
 * Die Akte (alle Vorgaenge, Stammdaten, Verbund, KMU, De-minimis, Vollmacht,
 * Dokumente, Entwuerfe, Uebergaben, Audit) wird erst beim Aufklappen ueber
 * die Admin-Server-Action `ladeFallakte` nachgeladen – die Liste selbst
 * bleibt dadurch schnell, auch bei vielen Kunden.
 */

const STATUS_KURZ: Record<AngebotStatus, string> = {
  angelegt: 'Angelegt',
  eingeladen: 'Eingeladen',
  in_bearbeitung: 'In Bearb.',
  eingereicht: 'Eingereicht',
  abgeschlossen: 'Abgeschl.',
  widerrufen: 'Widerrufen',
}

type AktenZustand =
  | { status: 'laden' }
  | { status: 'fehler'; fehler: string }
  | { status: 'fertig'; kunde: KundeDetail; vorlagen: SystemkonzeptVorlage[] }

export function KundenListe({ kunden }: { kunden: KundeUebersicht[] }) {
  const [offen, setOffen] = useState<Record<string, boolean>>({})
  const [akten, setAkten] = useState<Record<string, AktenZustand>>({})

  async function ladeAkte(email: string) {
    const schluessel = email.toLowerCase()
    setAkten((a) => ({ ...a, [schluessel]: { status: 'laden' } }))
    const antwort = await ladeFallakte(email)
    setAkten((a) => ({
      ...a,
      [schluessel]: antwort.ok
        ? { status: 'fertig', kunde: antwort.kunde, vorlagen: antwort.vorlagen }
        : { status: 'fehler', fehler: antwort.fehler },
    }))
  }

  async function umschalten(email: string) {
    const schluessel = email.toLowerCase()
    const wirdAufgeklappt = !offen[schluessel]
    setOffen((o) => ({ ...o, [schluessel]: wirdAufgeklappt }))
    // Lazy laden: nur beim ersten Aufklappen
    if (wirdAufgeklappt && !akten[schluessel]) {
      await ladeAkte(email)
    }
  }

  return (
    <ul className="flex flex-col gap-3">
      {kunden.map((k) => {
        const schluessel = k.email.toLowerCase()
        const istOffen = !!offen[schluessel]
        const akt = akten[schluessel]
        return (
          <li key={k.email} className="overflow-hidden rounded-2xl border border-olive-200 bg-white">
            {/* Kopfzeile: klickbar, klappt die Fallakte auf */}
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => void umschalten(k.email)}
                aria-expanded={istOffen}
                aria-controls={`fallakte-${schluessel}`}
                className="flex min-h-14 min-w-0 flex-1 flex-col gap-2 p-4 text-left transition-colors hover:bg-olive-50/60 focus-visible:bg-teal-50 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4"
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-transform ${
                    istOffen ? 'rotate-90 bg-mabe-900 text-white' : 'bg-olive-100 text-olive-600'
                  }`}
                  aria-hidden
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.94 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.24a.75.75 0 0 1 0 1.06l-4.25 4.24a.75.75 0 0 1-1.06 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-mabe-900">{k.firma}</span>
                  <span className="block truncate text-xs text-olive-500">{k.email}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-olive-100 px-2 py-0.5 text-[11px] font-medium text-olive-700 tabular-nums">
                    {k.anzahlVorgaenge} {k.anzahlVorgaenge === 1 ? 'Vorgang' : 'Vorgänge'}
                  </span>
                  {[...new Set(k.status)].map((s) => (
                    <span key={s} className="rounded-full bg-olive-100 px-2 py-0.5 text-[11px] text-olive-700">
                      {STATUS_KURZ[s]}
                    </span>
                  ))}
                  {k.registriert ? (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                      registriert
                    </span>
                  ) : (
                    <span className="rounded-full bg-olive-100 px-2 py-0.5 text-[11px] text-olive-600">
                      kein Konto
                    </span>
                  )}
                  <span className="text-[11px] text-olive-400 tabular-nums">
                    zuletzt {new Date(k.letzterVorgang).toLocaleDateString('de-DE')}
                  </span>
                </span>
              </button>
              <Link
                href={`/admin/kunden/${encodeURIComponent(k.email)}`}
                className="flex shrink-0 items-center border-l border-olive-100 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50 sm:px-4"
                aria-label={`Fallakte von ${k.firma} als eigene Seite öffnen`}
              >
                Seite&nbsp;↗
              </Link>
            </div>

            {/* Aufgeklappte Fallakte */}
            {istOffen && (
              <div id={`fallakte-${schluessel}`} className="border-t border-olive-100 bg-olive-50/40 p-3 sm:p-5">
                {!akt || akt.status === 'laden' ? (
                  <p className="flex items-center gap-2 px-2 py-6 text-sm text-olive-600" role="status">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 animate-spin text-teal-700" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M10 2a8 8 0 1 0 8 8 .75.75 0 0 1 1.5 0A9.5 9.5 0 1 1 10 .5.75.75 0 0 1 10 2Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Fallakte wird geladen …
                  </p>
                ) : akt.status === 'fehler' ? (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200" role="alert">
                    {akt.fehler}
                  </p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {akt.kunde.vorgaenge.map((v, i) => (
                      <div key={v.angebot.id}>
                        {akt.kunde.vorgaenge.length > 1 && (
                          <p className="mb-2 text-xs font-semibold tracking-wide text-olive-500 uppercase">
                            Vorgang {i + 1} von {akt.kunde.vorgaenge.length}
                          </p>
                        )}
                        <VorgangDatenblatt
                          vorgang={v}
                          vorlagen={akt.vorlagen}
                          onGespeichert={() => void ladeAkte(k.email)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
