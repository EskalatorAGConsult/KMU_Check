'use client'

import { useState, useTransition } from 'react'

import type { BescheidAnalyse } from '@/lib/gemini/bescheid-analyse'
import type { BescheidRow } from '@/lib/db/types'

import { bestaetigeBescheidDaten, ladeBescheidHoch, speichereZeitraum } from '@/lib/bescheid/actions'

import { DragDropZone } from './drag-drop'

/**
 * Bescheid-Station (Kunde UND Admin): Drag-&-Drop-Upload des Zuwendungs-
 * bescheids, OCR-Vorbefüllung zum Prüfen, Bestätigung (aktiviert
 * 'bewilligt') sowie Durchführungszeitraum & VNW-Vorlagefrist.
 * Wiederverwendbar über `modus` – die Server Action autorisiert beide
 * Rollen über den Vorgangszugriff.
 */
export function BescheidManager({
  angebotId,
  bescheid,
  ocrStart,
  dokumentId,
  downloadBasis,
}: {
  angebotId: string
  bescheid: BescheidRow | null
  /** OCR-Ergebnis des letzten Uploads (aus bescheid.ocr, serverseitig gelesen). */
  ocrStart: BescheidAnalyse | null
  /** Dokument-ID der aktuellen Bescheid-Datei (Download-Link), falls vorhanden. */
  dokumentId?: string | null
  /** Basis-URL der Download-Proxy-Routen: Kundenkonto oder Admin. */
  downloadBasis?: string
}) {
  const [analyse, setAnalyse] = useState<BescheidAnalyse | null>(ocrStart)
  const [form, setForm] = useState({
    aktenzeichen: bescheid?.aktenzeichen ?? '',
    bewilligt_am: bescheid?.bewilligt_am ?? '',
    foerderquote_pct: bescheid?.foerderquote_pct ? String(bescheid.foerderquote_pct) : '',
    foerdersumme_eur: bescheid?.foerdersumme_eur ? String(bescheid.foerdersumme_eur) : '',
    durchfuehrung_von: bescheid?.durchfuehrung_von ?? '',
    durchfuehrung_bis: bescheid?.durchfuehrung_bis ?? '',
    vnw_frist_am: bescheid?.vnw_frist_am ?? '',
    notiz: bescheid?.notiz ?? '',
  })
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [busy, startTransition] = useTransition()

  const hat = bescheid !== null
  const bestaetigt = bescheid?.bestaetigt_am != null

  const inputCls =
    'min-h-11 w-full rounded-xl border border-olive-300 bg-white px-3.5 text-sm text-mabe-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20'

  const hochladen = (datei: File) => {
    const fd = new FormData()
    fd.set('datei', datei)
    setMeldung(null)
    startTransition(async () => {
      const res = await ladeBescheidHoch(angebotId, fd)
      if (res.ok) {
        setAnalyse(res.analyse ?? null)
        // OCR-Werte direkt in das Formular übernehmen (pruefbar/editierbar).
        if (res.analyse) {
          setForm((f) => ({
            ...f,
            aktenzeichen: res.analyse?.aktenzeichen ?? f.aktenzeichen,
            bewilligt_am: res.analyse?.bewilligt_am ?? f.bewilligt_am,
            foerderquote_pct: res.analyse?.foerderquote_pct ? String(res.analyse.foerderquote_pct) : f.foerderquote_pct,
            foerdersumme_eur: res.analyse?.foerdersumme_eur != null ? String(res.analyse.foerdersumme_eur) : f.foerdersumme_eur,
            durchfuehrung_von: res.analyse?.durchfuehrung_von ?? f.durchfuehrung_von,
            durchfuehrung_bis: res.analyse?.durchfuehrung_bis ?? f.durchfuehrung_bis,
            vnw_frist_am: res.analyse?.vnw_frist_am ?? f.vnw_frist_am,
          }))
        }
        setMeldung({ art: 'ok', text: res.hinweis ?? 'Bescheid hochgeladen.' })
      } else {
        setMeldung({ art: 'fehler', text: res.fehler })
      }
    })
  }

  const bestaetigen = () => {
    setMeldung(null)
    startTransition(async () => {
      const res = await bestaetigeBescheidDaten(angebotId, {
        aktenzeichen: form.aktenzeichen || undefined,
        bewilligt_am: form.bewilligt_am || undefined,
        foerderquote_pct: form.foerderquote_pct ? Number(form.foerderquote_pct) : undefined,
        foerdersumme_eur: form.foerdersumme_eur ? Number(form.foerdersumme_eur.replace(',', '.')) : undefined,
        durchfuehrung_von: form.durchfuehrung_von || undefined,
        durchfuehrung_bis: form.durchfuehrung_bis || undefined,
        vnw_frist_am: form.vnw_frist_am || undefined,
        auflagen: analyse?.auflagen ?? [],
        notiz: form.notiz || undefined,
      })
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis ?? 'Gespeichert.' } : { art: 'fehler', text: res.fehler })
    })
  }

  const zeitraumSpeichern = () => {
    setMeldung(null)
    startTransition(async () => {
      const res = await speichereZeitraum(angebotId, {
        durchfuehrung_von: form.durchfuehrung_von || undefined,
        durchfuehrung_bis: form.durchfuehrung_bis || undefined,
        vnw_frist_am: form.vnw_frist_am || undefined,
      })
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis ?? 'Gespeichert.' } : { art: 'fehler', text: res.fehler })
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1 · Upload */}
      <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
        <h2 className="min-w-0 text-base font-semibold text-balance [overflow-wrap:break-word] text-mabe-900" style={{ overflowWrap: 'break-word', minWidth: 0 }}>1 · Zuwendungsbescheid hochladen</h2>
        <p className="mt-1 text-sm/6 text-olive-600">
          Sobald das BAFA Ihren Antrag bewilligt hat, laden Sie hier den Zuwendungsbescheid hoch (PDF). Wir lesen
          Fristen und Auflagen automatisch aus, zur Sicherheit prüfen Sie die Werte einmal kurz.
        </p>
        <div className="mt-4">
          <DragDropZone
            label={hat ? 'Anderen/neuen Bescheid hochladen (ersetzt die bisherige Datei)' : 'Zuwendungsbescheid hierher ziehen oder auswählen'}
            hinweis="PDF, maximal 15 MB. Der Bescheid wird verschlüsselt gespeichert und nur für Ihr Förderverfahren verwendet."
            accept=".pdf,application/pdf"
            pending={busy}
            onDatei={hochladen}
          />
        </div>
        {hat && dokumentId && (
          <a
            href={`${downloadBasis ?? `/konto/vorgang/${angebotId}/dokument`}/${dokumentId}`}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-teal-600 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50"
          >
            Aktuelle Bescheid-Datei ansehen ↓
          </a>
        )}
      </section>

      {/* 2 · Bescheiddaten prüfen & bestätigen */}
      {hat && (
        <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="min-w-0 text-base font-semibold text-balance [overflow-wrap:break-word] text-mabe-900" style={{ overflowWrap: 'break-word', minWidth: 0 }}>2 · Bescheiddaten prüfen & bestätigen</h2>
            {bestaetigt ? (
              <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">
                bestätigt
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                noch unbestätigt
              </span>
            )}
          </div>
          <p className="mt-1 text-sm/6 text-olive-600">
            {analyse
              ? 'Die folgenden Werte wurden automatisch aus dem Bescheid gelesen, bitte prüfen und korrigieren, dann bestätigen.'
              : 'Tragen Sie die Angaben aus dem Bescheid ein (automatisches Lesen war nicht möglich).'}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-olive-600">
              Aktenzeichen
              <input className={inputCls} value={form.aktenzeichen} onChange={(e) => setForm({ ...form, aktenzeichen: e.target.value })} placeholder="z. B. vom BAFA-Geschäftszeichen" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-olive-600">
              Datum des Bescheids
              <input type="date" className={inputCls} value={form.bewilligt_am} onChange={(e) => setForm({ ...form, bewilligt_am: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-olive-600">
              Bewilligte Förderquote (%)
              <input type="number" min={25} max={45} step={1} className={inputCls} value={form.foerderquote_pct} onChange={(e) => setForm({ ...form, foerderquote_pct: e.target.value })} placeholder="25 / 35 / 45" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-olive-600">
              Bewilligter Zuschuss (EUR)
              <input type="number" min={0} step="0.01" className={inputCls} value={form.foerdersumme_eur} onChange={(e) => setForm({ ...form, foerdersumme_eur: e.target.value })} />
            </label>
          </div>
          <button
            type="button"
            onClick={bestaetigen}
            disabled={busy}
            className="mt-5 min-h-12 rounded-xl bg-mabe-900 px-6 py-3 text-sm font-semibold text-white hover:bg-mabe-800 disabled:opacity-50"
          >
            {busy ? 'Speichert …' : 'Daten bestätigen, Bewilligung aktivieren'}
          </button>
        </section>
      )}

      {/* 3 · Durchführungszeitraum & Vorlagefrist */}
      {hat && (
        <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
          <h2 className="min-w-0 text-base font-semibold text-balance [overflow-wrap:break-word] text-mabe-900" style={{ overflowWrap: 'break-word', minWidth: 0 }}>3 · Durchführungszeitraum & Vorlagefrist</h2>
          <p className="mt-1 text-sm/6 text-olive-600">
            Der Bewilligungszeitraum steht im Bescheid. Die Vorlagefrist für den Verwendungsnachweis ebenfalls –
            beide können Sie hier anpassen (z. B. bei Verlängerung durch das BAFA).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-olive-600">
              Beginn
              <input type="date" className={inputCls} value={form.durchfuehrung_von} onChange={(e) => setForm({ ...form, durchfuehrung_von: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-olive-600">
              Ende
              <input type="date" className={inputCls} value={form.durchfuehrung_bis} onChange={(e) => setForm({ ...form, durchfuehrung_bis: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-olive-600">
              VNW-Vorlagefrist
              <input type="date" className={inputCls} value={form.vnw_frist_am} onChange={(e) => setForm({ ...form, vnw_frist_am: e.target.value })} />
            </label>
          </div>
          <button
            type="button"
            onClick={zeitraumSpeichern}
            disabled={busy}
            className="mt-5 min-h-12 rounded-xl border border-teal-600 bg-white px-6 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
          >
            Zeitraum & Frist speichern
          </button>
        </section>
      )}

      {/* Auflagen/Hinweise aus der OCR (nur Anzeige) */}
      {hat && (analyse?.auflagen?.length || analyse?.hinweise?.length) ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Aus dem Bescheid gelesene Auflagen & Hinweise</h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm/6 text-amber-900">
            {(analyse?.auflagen ?? []).map((a, i) => (
              <li key={`au-${i}`}>{a}</li>
            ))}
            {(analyse?.hinweise ?? []).map((h, i) => (
              <li key={`hi-${i}`}>{h}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs/5 text-amber-700">
            Unverbindlicher Auszug aus der automatischen Erkennung, maßgeblich ist der Wortlaut des Bescheids.
          </p>
        </section>
      ) : null}

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
