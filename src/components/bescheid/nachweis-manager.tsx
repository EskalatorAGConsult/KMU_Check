'use client'

import { useState, useTransition } from 'react'

import type { VerwendungsnachweisRow, VnwBelegKategorie } from '@/lib/db/types'
import { VNW_BELEG_KATEGORIE_LABELS } from '@/lib/labels'
import type { VnwBelegMitDokument } from '@/lib/db/repositories/bescheid'
import { type FristStatus } from '@/lib/bescheid/domain'

import { entferneBeleg, ladeBelegHoch, reicheVerwendungsnachweisEin, speichereVnwSachbericht } from '@/lib/bescheid/actions'

import { DragDropZone } from './drag-drop'

/**
 * Verwendungsnachweis-Station (Kunde UND Admin): Frist-Ampel, Beleg-Upload
 * per Drag & Drop (Rechnungen/Zahlungsnachweise mit Kategorie & Betrag),
 * Sachbericht und Einreichung. Aktiv nur mit hochgeladenem Bescheid –
 * die aktivierte/deaktiviert-Logik liefert die Domäne (NachweisKontext),
 * die Seite rendert entsprechend.
 */
export function NachweisManager({
  angebotId,
  vnw,
  belege,
  frist,
  belegSummeEur,
  fehlendeBausteine,
  darfEinreichen,
  downloadBasis,
}: {
  angebotId: string
  vnw: VerwendungsnachweisRow | null
  belege: VnwBelegMitDokument[]
  /** Frist-Ampel aus der Domäne (serverseitig berechnet). */
  frist: { status: FristStatus; tageRest: number | null }
  belegSummeEur: number
  fehlendeBausteine: string[]
  darfEinreichen: boolean
  downloadBasis?: string
}) {
  const [sachbericht, setSachbericht] = useState(vnw?.sachbericht ?? '')
  const [kategorie, setKategorie] = useState<VnwBelegKategorie>('rechnung')
  const [betrag, setBetrag] = useState('')
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [busy, startTransition] = useTransition()

  const eingereicht = vnw?.status === 'eingereicht'
  const basis = downloadBasis ?? `/konto/vorgang/${angebotId}/dokument`

  const eur = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

  const FRIST_VIEW: Record<FristStatus, { label: string; cls: string; text: string }> = {
    eingereicht: { label: 'Eingereicht', cls: 'bg-teal-600 text-white', text: 'Der Verwendungsnachweis ist übergeben, die Fristuhr steht still.' },
    ok: { label: 'Frist im grünen Bereich', cls: 'bg-teal-100 text-teal-800', text: 'Noch genug Zeit, Belege sammeln sich erfahrungsgemäß schnell an.' },
    knapp: { label: 'Frist läuft in Kürze ab', cls: 'bg-amber-100 text-amber-900', text: 'Bitte jetzt die Belege vervollständigen und einreichen.' },
    ueberfaellig: { label: 'Frist überschritten', cls: 'bg-red-100 text-red-700', text: 'Die Vorlagefrist ist überschritten, bitte umgehend einreichen und MABE informieren (Förderrisiko).' },
    ungefasst: { label: 'Frist noch nicht erfasst', cls: 'bg-olive-100 text-olive-700', text: 'In Ihrem Bescheid ist keine eindeutige Frist erkennbar, bitte auf der Bescheid-Seite erfassen oder erfragen.' },
  }
  const fristView = FRIST_VIEW[frist.status]

  const belegHochladen = (datei: File) => {
    const fd = new FormData()
    fd.set('datei', datei)
    setMeldung(null)
    startTransition(async () => {
      const res = await ladeBelegHoch(angebotId, fd, {
        kategorie,
        betrag_eur: betrag ? Number(betrag.replace(',', '.')) : undefined,
      })
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis ?? 'Beleg hinzugefügt.' } : { art: 'fehler', text: res.fehler })
      if (res.ok) setBetrag('')
    })
  }

  const sachberichtSpeichern = () => {
    setMeldung(null)
    startTransition(async () => {
      const res = await speichereVnwSachbericht(angebotId, sachbericht)
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis ?? 'Gespeichert.' } : { art: 'fehler', text: res.fehler })
    })
  }

  const einreichen = () => {
    setMeldung(null)
    startTransition(async () => {
      const res = await reicheVerwendungsnachweisEin(angebotId)
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis ?? 'Eingereicht.' } : { art: 'fehler', text: res.fehler })
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Frist-Ampel */}
      <section className={`rounded-2xl p-5 sm:p-6 ${frist.status === 'ueberfaellig' ? 'bg-red-50' : 'bg-white'} border border-olive-200`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="min-w-0 text-base font-semibold text-balance [overflow-wrap:break-word] text-mabe-900" style={{ overflowWrap: 'break-word', minWidth: 0 }}>Vorlagefrist Verwendungsnachweis</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${fristView.cls}`}>{fristView.label}</span>
        </div>
        <p className="mt-1.5 text-sm/6 text-olive-600">{fristView.text}</p>
        {frist.tageRest != null && !eingereicht && (
          <p className="mt-2 text-sm font-semibold text-mabe-900 tabular-nums">
            {frist.tageRest >= 0 ? `Noch ${frist.tageRest} Tag(e) Zeit.` : `${Math.abs(frist.tageRest)} Tag(e) über der Frist.`}
          </p>
        )}
      </section>

      {/* Belege */}
      <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="min-w-0 text-base font-semibold text-balance [overflow-wrap:break-word] text-mabe-900" style={{ overflowWrap: 'break-word', minWidth: 0 }}>Belege ({belege.length})</h2>
          {belege.length > 0 && (
            <p className="text-sm text-olive-600">
              Belegsumme (erfasst): <strong className="text-mabe-900 tabular-nums">{eur(belegSummeEur)}</strong>
            </p>
          )}
        </div>
        <p className="mt-1 text-sm/6 text-olive-600">
          Rechnungen und Zahlungsnachweise der geförderten Maßnahme, das BAFA verlangt sie im
          Verwendungsnachweis (zusammen mit dem Sachbericht).
        </p>

        {!eingereicht ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-olive-600">
                Kategorie des nächsten Belegs
                <select
                  className="min-h-11 rounded-xl border border-olive-300 bg-white px-3.5 text-sm text-mabe-900"
                  value={kategorie}
                  onChange={(e) => setKategorie(e.target.value as VnwBelegKategorie)}
                >
                  {Object.entries(VNW_BELEG_KATEGORIE_LABELS).map(([wert, label]) => (
                    <option key={wert} value={wert}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-olive-600">
                Belegbetrag (EUR, optional)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="min-h-11 rounded-xl border border-olive-300 bg-white px-3.5 text-sm text-mabe-900"
                  value={betrag}
                  onChange={(e) => setBetrag(e.target.value)}
                  placeholder="z. B. 8500"
                />
              </label>
            </div>
            <div className="mt-3">
              <DragDropZone
                kompakt
                label="Beleg hierher ziehen oder auswählen"
                hinweis="PDF, PNG oder JPG · max. 15 MB"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                pending={busy}
                onDatei={belegHochladen}
              />
            </div>
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
            Eingereicht, Belege sind archiviert und nicht mehr veränderbar.
          </p>
        )}

        {belege.length > 0 && (
          <ul className="mt-4 flex flex-col divide-y divide-olive-100">
            {belege.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <a
                    href={`${basis}/${b.dokument.id}`}
                    className="text-sm font-semibold text-teal-700 hover:underline"
                  >
                    {b.dokument.storage_path.split('/').pop() ?? 'Beleg'} ↓
                  </a>
                  <p className="text-xs/5 text-olive-500">
                    {VNW_BELEG_KATEGORIE_LABELS[b.kategorie]}
                    {b.betrag_eur != null && ` · ${eur(b.betrag_eur)}`} · {new Date(b.created_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
                {!eingereicht && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await entferneBeleg(angebotId, b.id)
                        setMeldung(res.ok ? { art: 'ok', text: res.hinweis ?? 'Beleg entfernt.' } : { art: 'fehler', text: res.fehler })
                      })
                    }
                    className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Entfernen
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sachbericht */}
      <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
        <h2 className="min-w-0 text-base font-semibold text-balance [overflow-wrap:break-word] text-mabe-900" style={{ overflowWrap: 'break-word', minWidth: 0 }}>Sachbericht</h2>
        <p className="mt-1 text-sm/6 text-olive-600">
          Kurz beschreiben, was umgesetzt wurde (Lieferung, Installation, Inbetriebnahme der Messtechnik und
          Software). Fließt in den Verwendungsnachweis ein.
        </p>
        <textarea
          className="mt-3 min-h-36 w-full rounded-xl border border-olive-300 bg-white p-3.5 text-sm text-mabe-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          maxLength={8000}
          value={sachbericht}
          disabled={eingereicht}
          onChange={(e) => setSachbericht(e.target.value)}
          placeholder="z. B. Im Oktober wurden 28 Sensoren installiert und an MABE smart control angebunden …"
        />
        {!eingereicht && (
          <button
            type="button"
            onClick={sachberichtSpeichern}
            disabled={busy}
            className="mt-3 min-h-11 rounded-xl border border-teal-600 bg-white px-5 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
          >
            Sachbericht speichern
          </button>
        )}
      </section>

      {/* Einreichung */}
      {!eingereicht ? (
        <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
          <h2 className="min-w-0 text-base font-semibold text-balance [overflow-wrap:break-word] text-mabe-900" style={{ overflowWrap: 'break-word', minWidth: 0 }}>Verwendungsnachweis einreichen</h2>
          {darfEinreichen ? (
            <>
              <p className="mt-1 text-sm/6 text-olive-600">
                Alle Bausteine liegen vor. Mit dem Einreichen dokumentieren wir Zeitpunkt und Verantwortliche/r –
                die Datenübergabe an das BAFA-Portal (FZD) übernimmt Ihr Fördermittel-Team.
              </p>
              <button
                type="button"
                onClick={einreichen}
                disabled={busy}
                className="mt-4 min-h-12 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {busy ? 'Reicht ein …' : 'Verwendungsnachweis einreichen ✓'}
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm/6 text-olive-600">
              Noch offen: <strong className="text-mabe-900">{fehlendeBausteine.join(' · ')}</strong>
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-2xl bg-mabe-900 p-5 text-white sm:p-6">
          <h2 className="text-base font-semibold" style={{ overflowWrap: 'break-word', minWidth: 0 }}>Verwendungsnachweis eingereicht ✓</h2>
          <p className="mt-1 text-sm/6 text-olive-200">
            {vnw?.eingereicht_am ? `Übergeben am ${new Date(vnw.eingereicht_am).toLocaleString('de-DE')}.` : ''} Die
            Auszahlung des Zuschusses folgt nach Prüfung durch das BAFA.
          </p>
        </section>
      )}

      {meldung && (
        <p
          role={meldung.art === 'ok' ? 'status' : 'alert'}
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            meldung.art === 'ok' ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {meldung.text}
        </p>
      )}
    </div>
  )
}
