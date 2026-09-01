'use client'

import { useState, useTransition } from 'react'

import {
  aendereVorgangStatus,
  erneutEinladen,
  erstelleJourneyLink,
  loescheVorgangDsgvo,
  widerrufeVorgang,
} from '@/lib/admin/kunden-actions'
import { erlaubteZiele } from '@/lib/admin/status'
import type { AngebotStatus } from '@/lib/db/types'
import { ANGEBOT_STATUS_LABELS } from '@/lib/labels'

type Ergebnis = { ok: true; hinweis: string } | { ok: false; fehler: string }

/**
 * Aktions-Leiste eines Vorgangs (Berater-Arbeitsplatz): Einladung versenden,
 * Journey-Link kopieren (ohne Versand), manueller Statuswechsel (mit
 * Revisionshistorie), Widerruf und DSGVO-Loeschung mit Tipp-Bestaetigung.
 */
export function VorgangAktionen({
  angebotId,
  status,
  angebotNr,
}: {
  angebotId: string
  status: AngebotStatus
  angebotNr: string
}) {
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [kopierterLink, setKopierterLink] = useState<string | null>(null)
  const [zielStatus, setZielStatus] = useState<AngebotStatus | ''>('')
  const [loeschOffen, setLoeschOffen] = useState(false)
  const [bestaetigung, setBestaetigung] = useState('')
  const [pending, startTransition] = useTransition()

  const einladbar = !['eingereicht', 'abgeschlossen', 'widerrufen'].includes(status)
  const widerrufbar = status !== 'widerrufen'
  const ziele = erlaubteZiele(status)
  // Seit der Entkopplung des Versands bleibt ein neuer Vorgang 'angelegt',
  // bis die Einladungs-Mail manuell ausgeloest wird.
  const einladungLabel = status === 'angelegt' ? '✉️ Einladungs-E-Mail senden' : 'Einladung erneut senden'

  const ausfuehren = (aktion: () => Promise<Ergebnis>) => {
    setMeldung(null)
    startTransition(async () => {
      const res = await aktion()
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis } : { art: 'fehler', text: res.fehler })
    })
  }

  const linkKopieren = () => {
    setMeldung(null)
    setKopierterLink(null)
    startTransition(async () => {
      const res = await erstelleJourneyLink(angebotId)
      if (!res.ok) {
        setMeldung({ art: 'fehler', text: res.fehler })
        return
      }
      try {
        await navigator.clipboard.writeText(res.link)
        setMeldung({ art: 'ok', text: res.hinweis })
      } catch {
        // Clipboard-API nicht verfuegbar (z. B. HTTP-Kontext) -> Link anzeigen
        setKopierterLink(res.link)
        setMeldung({ art: 'ok', text: 'Link erstellt – bitte manuell kopieren:' })
      }
    })
  }

  const inputCls =
    'rounded-lg border border-olive-300 bg-white px-3 py-2 text-sm text-mabe-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {einladbar && (
          <button
            type="button"
            disabled={pending}
            onClick={() => ausfuehren(() => erneutEinladen(angebotId))}
            className="rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {einladungLabel}
          </button>
        )}
        {einladbar && (
          <button
            type="button"
            disabled={pending}
            onClick={linkKopieren}
            title="Neuen Journey-Link erstellen und kopieren – ohne E-Mail-Versand (z. B. für WhatsApp/Telefon)"
            className="rounded-lg border border-teal-600 bg-white px-3.5 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
          >
            🔗 Link kopieren
          </button>
        )}

        {/* Manueller Statuswechsel (erlaubte Uebergaenge aus status.ts) */}
        {ziele.length > 0 && (
          <div className="flex items-center gap-1.5">
            <select
              value={zielStatus}
              onChange={(e) => setZielStatus(e.target.value as AngebotStatus | '')}
              className={inputCls}
              aria-label="Neuer Status"
            >
              <option value="">Status wählen …</option>
              {ziele.map((s) => (
                <option key={s} value={s}>
                  {ANGEBOT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending || !zielStatus}
              onClick={() => {
                if (!zielStatus) return
                const ziel = zielStatus
                ausfuehren(() => aendereVorgangStatus(angebotId, ziel))
                setZielStatus('')
              }}
              className="rounded-lg bg-mabe-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-mabe-800 disabled:opacity-50"
            >
              Status setzen
            </button>
          </div>
        )}

        {widerrufbar && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm('Vorgang wirklich widerrufen? Bestehende Kunden-Links verlieren ihre Gültigkeit.')) {
                ausfuehren(() => widerrufeVorgang(angebotId))
              }
            }}
            className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Vorgang widerrufen
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => setLoeschOffen((o) => !o)}
          aria-expanded={loeschOffen}
          className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
        >
          🗑 DSGVO-Löschung …
        </button>
      </div>

      {meldung && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-xs font-medium ${
            meldung.art === 'ok' ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {meldung.text}
        </p>
      )}
      {kopierterLink && (
        <p className="rounded-lg bg-olive-50 px-3 py-2 font-mono text-xs break-all text-mabe-900 select-all ring-1 ring-olive-200">
          {kopierterLink}
        </p>
      )}

      {/* DSGVO-Loeschbereich: Tipp-Bestaetigung mit Angebotsnummer */}
      {loeschOffen && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-red-300 bg-red-50/60 p-4">
          <p className="text-xs/5 font-semibold text-red-800">
            Vollständige Löschung nach Art. 17 DSGVO – unwiderruflich
          </p>
          <p className="text-xs/5 text-red-700">
            Der Vorgang <strong>{angebotNr}</strong> wird mit allen Daten (Stammdaten, KMU, Beteiligungen,
            De-minimis, Vollmacht, Links, Zugriffsprotokoll, Notizen, Historie) endgültig gelöscht. Der
            Löschvorgang selbst wird anonymisiert im Audit-Log dokumentiert.
          </p>
          <label className="text-xs font-semibold text-red-800">
            Zur Bestätigung die Angebotsnummer eingeben:
            <input
              type="text"
              value={bestaetigung}
              onChange={(e) => setBestaetigung(e.target.value)}
              placeholder={angebotNr}
              className="mt-1 w-full rounded-lg border border-red-300 bg-white px-3 py-2 font-mono text-sm text-mabe-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 sm:max-w-xs"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || bestaetigung.trim() !== angebotNr}
              onClick={() =>
                ausfuehren(async () => {
                  const res = await loescheVorgangDsgvo(angebotId, bestaetigung)
                  if (res.ok) {
                    setLoeschOffen(false)
                    setBestaetigung('')
                  }
                  return res
                })
              }
              className="rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Endgültig löschen
            </button>
            <button
              type="button"
              onClick={() => {
                setLoeschOffen(false)
                setBestaetigung('')
              }}
              className="rounded-lg border border-olive-300 bg-white px-3.5 py-2 text-xs font-semibold text-olive-600 hover:bg-olive-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
