'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'

import {
  bearbeiteAngebot,
  bearbeiteStammdaten,
  type AngebotBearbeitenEingabe,
  type StammdatenBearbeitenEingabe,
} from '@/lib/admin/bearbeiten-actions'
import { FELD_LABEL } from '@/lib/admin/feld-labels'
import { formatiereWert } from '@/lib/admin/revision-diff'
import type { KundeVorgang } from '@/lib/db/repositories/kunden'
import type {
  Gruppenzugehoerigkeit,
  Personenart,
  SoftwareVariante,
  Technologie,
  Unternehmensart,
  VorgangRevisionRow,
} from '@/lib/db/types'

/**
 * Admin-Bearbeitung eines Vorgangs (Migration 19): korrigiert Angebots- und
 * Stammdaten direkt in der Fallakte – als Fördermittelberater auch komplett
 * im Namen des Kunden. Jede Speicherung wird serverseitig als feldgenauer
 * Diff in vorgang_revisionen protokolliert – die Historie unten zeigt,
 * WER wann welches Feld von alt auf neu gesetzt hat.
 */

const inputCls =
  'w-full rounded-lg border border-olive-300 bg-white px-3 py-2 text-sm text-mabe-900 placeholder:text-olive-400 ' +
  'focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30'
const labelCls = 'mb-1 block text-xs font-semibold text-mabe-900'

function Feld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  )
}

function TextFeld({ feld, wert, typ = 'text' }: { feld: string; wert: string | number | null | undefined; typ?: string }) {
  return (
    <Feld label={FELD_LABEL[feld] ?? feld}>
      <input name={feld} type={typ} className={inputCls} defaultValue={wert ?? ''} />
    </Feld>
  )
}

const TECHNOLOGIEN: { wert: Technologie; label: string }[] = [
  { wert: 'software', label: 'Energiemanagementsoftware' },
  { wert: 'messtechnik', label: 'Mess- und Sensortechnik' },
  { wert: 'steuerung', label: 'Steuerungs- und Regelungstechnik' },
]

function Historie({
  revisionen,
  bearbeiter,
}: {
  revisionen: VorgangRevisionRow[]
  bearbeiter: Record<string, string>
}) {
  if (revisionen.length === 0) {
    return <p className="text-xs text-olive-500">Noch keine Korrekturen protokolliert.</p>
  }
  return (
    <ol className="flex flex-col gap-3">
      {revisionen.map((r) => (
        <li key={r.id} className="rounded-xl bg-olive-50 px-4 py-3 ring-1 ring-olive-200">
          <p className="text-xs text-olive-500">
            {new Date(r.created_at).toLocaleString('de-DE')} ·{' '}
            <span className="font-semibold text-mabe-900">{bearbeiter[r.bearbeitet_von] ?? 'Unbekannt'}</span> ·
            Bereich: <span className="font-semibold">{r.bereich === 'angebot' ? 'Angebot' : 'Stammdaten'}</span>
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {Object.entries(r.aenderungen).map(([feld, a]) => (
              <li key={feld} className="text-xs/5 text-mabe-900">
                <span className="font-semibold">{FELD_LABEL[feld] ?? feld}:</span>{' '}
                <span className="text-red-700 line-through decoration-red-300">{formatiereWert(a.alt)}</span>{' '}
                → <span className="font-medium text-teal-800">{formatiereWert(a.neu)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

export function VorgangBearbeiten({
  vorgang,
  onGespeichert,
}: {
  vorgang: KundeVorgang
  /** Optionaler Reload-Hook (aufklappbare Fallakte laedt die Daten clientseitig neu). */
  onGespeichert?: () => void
}) {
  const router = useRouter()
  const a = vorgang.angebot
  const sd = vorgang.stammdaten
  const [bereich, setBereich] = useState<'angebot' | 'stammdaten' | null>(null)
  const [technologien, setTechnologien] = useState<Technologie[]>(a.technologien)
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const toggleTech = (t: Technologie) =>
    setTechnologien((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  const nachErfolg = () => {
    router.refresh() // Einzelseite (Server Component) neu rendern
    onGespeichert?.() // aufklappbare Fallakte clientseitig neu laden
  }

  const speichernAngebot = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const s = (k: string) => String(fd.get(k) ?? '')
    const eingabe: AngebotBearbeitenEingabe = {
      kunde_firma: s('kunde_firma'),
      kunde_ansprechpartner: s('kunde_ansprechpartner'),
      kunde_email: s('kunde_email'),
      angebot_nr: s('angebot_nr'),
      angebot_datum: s('angebot_datum'),
      technologien,
      software_variante: s('software_variante') as SoftwareVariante | '',
      invest_software: s('invest_software'),
      invest_messtechnik: s('invest_messtechnik'),
      invest_steuerung: s('invest_steuerung'),
      sensoren_gesamt: s('sensoren_gesamt'),
      sensoren_prozessbezug: s('sensoren_prozessbezug'),
      projektende: s('projektende'),
      notiz: s('notiz'),
    }
    startTransition(async () => {
      setMeldung(null)
      const res = await bearbeiteAngebot(a.id, eingabe)
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis } : { art: 'fehler', text: res.fehler })
      if (res.ok) nachErfolg()
    })
  }

  const speichernStammdaten = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const s = (k: string) => String(fd.get(k) ?? '')
    const eingabe: StammdatenBearbeitenEingabe = {
      unternehmensname: s('unternehmensname'),
      land: s('land'),
      plz: s('plz'),
      ort: s('ort'),
      strasse: s('strasse'),
      email: s('email'),
      wz_code: s('wz_code'),
      ust_id: s('ust_id'),
      steuernummer: s('steuernummer'),
      steuer_id: s('steuer_id'),
      geburtsdatum: s('geburtsdatum'),
      unternehmensart: s('unternehmensart') as Unternehmensart,
      personenart: s('personenart') as Personenart,
      vorsteuerabzug: s('vorsteuerabzug') === 'true',
      gruppenzugehoerigkeit: s('gruppenzugehoerigkeit') as Gruppenzugehoerigkeit,
      wirtschaftlich_taetig: s('wirtschaftlich_taetig') === 'true',
      ap_rolle: s('ap_rolle'),
      ap_anrede: s('ap_anrede'),
      ap_vorname: s('ap_vorname'),
      ap_nachname: s('ap_nachname'),
      ap_email: s('ap_email'),
      kontoinhaber: s('kontoinhaber'),
      iban: s('iban'),
      standort_plz: s('standort_plz'),
      standort_ort: s('standort_ort'),
      standort_strasse: s('standort_strasse'),
    }
    startTransition(async () => {
      setMeldung(null)
      const res = await bearbeiteStammdaten(a.id, eingabe)
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis } : { art: 'fehler', text: res.fehler })
      if (res.ok) nachErfolg()
    })
  }

  const umschalten = (b: 'angebot' | 'stammdaten') => {
    setBereich((cur) => (cur === b ? null : b))
    setMeldung(null)
  }

  return (
    <section className="rounded-2xl border border-mabe-200 bg-white p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-mabe-900">Daten korrigieren & Änderungshistorie</h3>
      <p className="mt-0.5 text-xs/5 text-olive-500">
        Korrekturen durch Admins – jede Änderung wird feldgenau (alt → neu) protokolliert und ist unten
        nachvollziehbar.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => umschalten('angebot')}
          aria-expanded={bereich === 'angebot'}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold ${
            bereich === 'angebot'
              ? 'bg-mabe-900 text-white'
              : 'border border-olive-300 bg-white text-mabe-900 hover:bg-olive-50'
          }`}
        >
          ✏️ Angebot bearbeiten
        </button>
        <button
          type="button"
          onClick={() => umschalten('stammdaten')}
          aria-expanded={bereich === 'stammdaten'}
          title={
            sd
              ? undefined
              : 'Der Kunde hat noch nichts eingereicht – als Fördermittelberater können Sie die Stammdaten komplett im Namen des Kunden anlegen.'
          }
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold ${
            bereich === 'stammdaten'
              ? 'bg-mabe-900 text-white'
              : 'border border-olive-300 bg-white text-mabe-900 hover:bg-olive-50'
          }`}
        >
          {sd ? '✏️ Stammdaten bearbeiten' : '➕ Stammdaten für den Kunden anlegen'}
        </button>
      </div>

      {meldung && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
            meldung.art === 'ok' ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {meldung.text}
        </p>
      )}

      {bereich === 'angebot' && (
        <form onSubmit={speichernAngebot} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextFeld feld="kunde_firma" wert={a.kunde_firma} />
          <TextFeld feld="kunde_ansprechpartner" wert={a.kunde_ansprechpartner} />
          <TextFeld feld="kunde_email" wert={a.kunde_email} typ="email" />
          <TextFeld feld="angebot_nr" wert={a.angebot_nr} />
          <TextFeld feld="angebot_datum" wert={a.angebot_datum} typ="date" />
          <TextFeld feld="projektende" wert={a.projektende} typ="date" />
          <div className="sm:col-span-2">
            <span className={labelCls}>Technologien</span>
            <div className="flex flex-wrap gap-2">
              {TECHNOLOGIEN.map((t) => (
                <label
                  key={t.wert}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium ${
                    technologien.includes(t.wert)
                      ? 'border-teal-600 bg-teal-50 text-teal-800'
                      : 'border-olive-300 bg-white text-olive-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={technologien.includes(t.wert)}
                    onChange={() => toggleTech(t.wert)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <Feld label="Software-Variante">
            <select name="software_variante" className={inputCls} defaultValue={a.software_variante ?? ''}>
              <option value="">– keine –</option>
              <option value="mabe_cloud">MABE Cloud</option>
              <option value="andere">Andere</option>
              <option value="offen">Noch offen</option>
            </select>
          </Feld>
          <TextFeld feld="invest_software" wert={a.invest_software} typ="number" />
          <TextFeld feld="invest_messtechnik" wert={a.invest_messtechnik} typ="number" />
          <TextFeld feld="invest_steuerung" wert={a.invest_steuerung} typ="number" />
          <TextFeld feld="sensoren_gesamt" wert={a.sensoren_gesamt} typ="number" />
          <TextFeld feld="sensoren_prozessbezug" wert={a.sensoren_prozessbezug} typ="number" />
          <div className="sm:col-span-2">
            <span className={labelCls}>{FELD_LABEL.notiz}</span>
            <textarea name="notiz" rows={2} className={inputCls} defaultValue={a.notiz ?? ''} />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
            >
              {pending ? 'Wird gespeichert …' : 'Angebot speichern (mit Historie)'}
            </button>
          </div>
        </form>
      )}

      {bereich === 'stammdaten' && (
        <form onSubmit={speichernStammdaten} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!sd && (
            <p className="rounded-lg border border-teal-600/30 bg-teal-50 px-3 py-2 text-xs/5 text-teal-900 sm:col-span-2">
              Der Kunde hat noch keine Daten eingereicht. Sie legen die Stammdaten hier als Fördermittelberater im
              Namen des Kunden an – die Anlage wird wie eine Korrektur mit Ihrem Namen in der Historie
              protokolliert. Pflichtfelder bitte vollständig ausfüllen.
            </p>
          )}
          <p className="text-xs font-semibold tracking-wide text-olive-500 uppercase sm:col-span-2">Unternehmen</p>
          <TextFeld feld="unternehmensname" wert={sd?.unternehmensname} />
          <Feld label={FELD_LABEL.land}>
            <select name="land" className={inputCls} defaultValue={sd?.land ?? 'Deutschland'}>
              <option value="Deutschland">Deutschland</option>
            </select>
          </Feld>
          <TextFeld feld="strasse" wert={sd?.strasse} />
          <TextFeld feld="plz" wert={sd?.plz} />
          <TextFeld feld="ort" wert={sd?.ort} />
          <TextFeld feld="email" wert={sd?.email} typ="email" />
          <TextFeld feld="wz_code" wert={sd?.wz_code} />
          <TextFeld feld="ust_id" wert={sd?.ust_id} />
          <TextFeld feld="steuernummer" wert={sd?.steuernummer} />
          <TextFeld feld="steuer_id" wert={sd?.steuer_id} />
          <TextFeld feld="geburtsdatum" wert={sd?.geburtsdatum} typ="date" />
          <Feld label={FELD_LABEL.unternehmensart}>
            <select name="unternehmensart" className={inputCls} defaultValue={sd?.unternehmensart ?? 'eigenstaendig'}>
              <option value="eigenstaendig">Eigenständig</option>
              <option value="partner">Partnerunternehmen</option>
              <option value="verbunden">Verbundenes Unternehmen</option>
            </select>
          </Feld>
          <Feld label={FELD_LABEL.personenart}>
            <select name="personenart" className={inputCls} defaultValue={sd?.personenart ?? 'juristisch'}>
              <option value="juristisch">Juristische Person</option>
              <option value="natuerlich">Natürliche Person</option>
            </select>
          </Feld>
          <Feld label={FELD_LABEL.vorsteuerabzug}>
            <select name="vorsteuerabzug" className={inputCls} defaultValue={String(sd?.vorsteuerabzug ?? true)}>
              <option value="true">Ja</option>
              <option value="false">Nein</option>
            </select>
          </Feld>
          <Feld label={FELD_LABEL.gruppenzugehoerigkeit}>
            <select name="gruppenzugehoerigkeit" className={inputCls} defaultValue={sd?.gruppenzugehoerigkeit ?? 'privat'}>
              <option value="privat">Privatwirtschaftlich</option>
              <option value="kommunal">Kommunal</option>
              <option value="land">Land / öffentlich</option>
              <option value="freiberuflich">Freiberuflich</option>
              <option value="contractor">Contractor</option>
            </select>
          </Feld>
          <Feld label={FELD_LABEL.wirtschaftlich_taetig}>
            <select name="wirtschaftlich_taetig" className={inputCls} defaultValue={String(sd?.wirtschaftlich_taetig ?? true)}>
              <option value="true">Ja</option>
              <option value="false">Nein</option>
            </select>
          </Feld>

          <p className="mt-2 text-xs font-semibold tracking-wide text-olive-500 uppercase sm:col-span-2">
            Ansprechpartner
          </p>
          <TextFeld feld="ap_rolle" wert={sd?.ap_rolle} />
          <TextFeld feld="ap_anrede" wert={sd?.ap_anrede} />
          <TextFeld feld="ap_vorname" wert={sd?.ap_vorname} />
          <TextFeld feld="ap_nachname" wert={sd?.ap_nachname} />
          <TextFeld feld="ap_email" wert={sd?.ap_email} typ="email" />

          <p className="mt-2 text-xs font-semibold tracking-wide text-olive-500 uppercase sm:col-span-2">
            Bank & Standort der Maßnahme
          </p>
          <TextFeld feld="kontoinhaber" wert={sd?.kontoinhaber} />
          <TextFeld feld="iban" wert={sd?.iban} />
          <TextFeld feld="standort_strasse" wert={sd?.standort_strasse} />
          <TextFeld feld="standort_plz" wert={sd?.standort_plz} />
          <TextFeld feld="standort_ort" wert={sd?.standort_ort} />

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
            >
              {pending
                ? 'Wird gespeichert …'
                : sd
                  ? 'Stammdaten speichern (mit Historie)'
                  : 'Stammdaten anlegen (mit Historie)'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-5 border-t border-olive-100 pt-4">
        <p className="mb-2 text-xs font-semibold tracking-wide text-olive-500 uppercase">
          Änderungshistorie ({vorgang.revisionen.length})
        </p>
        <Historie revisionen={vorgang.revisionen} bearbeiter={vorgang.bearbeiter} />
      </div>
    </section>
  )
}
