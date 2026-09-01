'use client'

import { useRef, useState, useTransition } from 'react'

import { analysiereAngebotPdf, erstelleAngebotAction, speichereAngebotPdf } from '@/lib/admin/actions'
import { erneutEinladen } from '@/lib/admin/kunden-actions'
import type { Technologie } from '@/lib/db/types'
import type { AngebotAnalyse } from '@/lib/gemini/parser'

const inputCls =
  'w-full rounded-xl border border-olive-300 bg-white px-4 py-3 text-base text-mabe-900 placeholder:text-olive-400 ' +
  'focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30'
const labelCls = 'mb-1.5 block text-sm font-semibold text-mabe-900'

const TECHNOLOGIEN: { wert: Technologie; label: string }[] = [
  { wert: 'software', label: 'Energiemanagementsoftware' },
  { wert: 'messtechnik', label: 'Mess- und Sensortechnik' },
  { wert: 'steuerung', label: 'Steuerungs- und Regelungstechnik' },
]

/** Welche Felder die KI erkannt hat – als Chips unter der Upload-Zone. */
const ERKANNT_LABEL: [keyof AngebotAnalyse, string][] = [
  ['kunde_firma', 'Firma'],
  ['kunde_ansprechpartner', 'Ansprechpartner'],
  ['kunde_email', 'E-Mail'],
  ['strasse', 'Adresse'],
  ['ust_id', 'USt-Id'],
  ['angebot_nr', 'Angebotsnr.'],
  ['angebot_datum', 'Datum'],
  ['invest_software', 'Software €'],
  ['invest_messtechnik', 'Messtechnik €'],
  ['invest_steuerung', 'Steuerung €'],
  ['sensoren_gesamt', 'Sensoren'],
  ['projektende', 'Projektende'],
]

export function AngebotForm() {
  const [technologien, setTechnologien] = useState<Technologie[]>(['messtechnik'])
  const [fehler, setFehler] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [angebotId, setAngebotId] = useState<string | null>(null)
  const [mailStatus, setMailStatus] = useState<'idle' | 'sendet' | 'ok' | 'fehler'>('idle')
  const [mailMeldung, setMailMeldung] = useState<string | null>(null)
  const [kopiert, setKopiert] = useState(false)
  const [busy, startTransition] = useTransition()

  // PDF-Upload + KI-Prefill
  const dateiInput = useRef<HTMLInputElement>(null)
  const [pdfDatei, setPdfDatei] = useState<File | null>(null)
  const [extraktion, setExtraktion] = useState<AngebotAnalyse | null>(null)
  const [analyseStatus, setAnalyseStatus] = useState<'idle' | 'laeuft' | 'ok' | 'fehler'>('idle')
  const [analyseFehler, setAnalyseFehler] = useState<string | null>(null)
  // Remount-Zaehler: nach dem Prefill werden die uncontrolled Inputs neu
  // montiert und uebernehmen ihre defaultValue-Werte.
  const [formVersion, setFormVersion] = useState(0)

  const toggleTech = (t: Technologie) =>
    setTechnologien((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  const analysiere = (datei: File) => {
    setPdfDatei(datei)
    setExtraktion(null)
    setAnalyseFehler(null)
    setAnalyseStatus('laeuft')
    const fd = new FormData()
    fd.set('datei', datei)
    void (async () => {
      const res = await analysiereAngebotPdf(fd)
      if (res.ok) {
        setExtraktion(res.analyse)
        setAnalyseStatus('ok')
        setFormVersion((v) => v + 1) // Inputs remounten -> Prefill sichtbar
      } else {
        setAnalyseStatus('fehler')
        setAnalyseFehler(res.fehler)
      }
    })()
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const opt = (k: string) => {
      const v = String(fd.get(k) ?? '').trim()
      return v === '' ? undefined : v
    }
    const optNum = (k: string) => {
      const v = opt(k)
      return v === undefined ? undefined : Number(v.replace(',', '.'))
    }
    const datei = pdfDatei
    const ex = extraktion
    startTransition(async () => {
      setFehler(null)
      const res = await erstelleAngebotAction({
        kunde_firma: String(fd.get('kunde_firma') ?? ''),
        kunde_ansprechpartner: opt('kunde_ansprechpartner'),
        kunde_email: String(fd.get('kunde_email') ?? ''),
        angebot_nr: String(fd.get('angebot_nr') ?? ''),
        angebot_datum: String(fd.get('angebot_datum') ?? ''),
        technologien,
        software_variante: opt('software_variante'),
        invest_software: optNum('invest_software'),
        invest_messtechnik: optNum('invest_messtechnik'),
        invest_steuerung: optNum('invest_steuerung'),
        sensoren_gesamt: optNum('sensoren_gesamt'),
        sensoren_prozessbezug: optNum('sensoren_prozessbezug'),
        projektende: opt('projektende'),
        notiz: opt('notiz'),
        extraktion: (ex ?? undefined) as Record<string, unknown> | undefined,
      })
      if (!res.ok) {
        setFehler(res.fehler)
        return
      }
      // Angebots-PDF zum Vorgang archivieren (best effort, Fehler nur loggen)
      if (datei) {
        const pdfFd = new FormData()
        pdfFd.set('datei', datei)
        const archiv = await speichereAngebotPdf(res.angebotId, pdfFd, ex)
        if (!archiv.ok) console.warn('[admin] PDF-Archivierung:', archiv.fehler)
      }
      setLink(`${window.location.origin}${res.link}`)
      setAngebotId(res.angebotId)
    })
  }

  const einladungSenden = () => {
    if (!angebotId) return
    setMailStatus('sendet')
    setMailMeldung(null)
    void (async () => {
      const res = await erneutEinladen(angebotId)
      setMailStatus(res.ok ? 'ok' : 'fehler')
      setMailMeldung(res.ok ? res.hinweis : res.fehler)
    })()
  }

  if (link) {
    return (
      <div className="flex max-w-2xl flex-col gap-5 rounded-2xl border border-teal-600/30 bg-teal-50/50 p-8">
        <h2 className="text-lg font-semibold text-mabe-900">Angebot angelegt – Kunden-Link bereit ✅</h2>
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm/6 text-amber-800 ring-1 ring-amber-200">
          <strong>Es wurde noch keine E-Mail versendet.</strong> Kopieren Sie den Link und schicken Sie ihn selbst –
          oder lösen Sie die Einladungs-E-Mail hier manuell aus.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-white px-4 py-3 text-sm break-all text-mabe-900 ring-1 ring-olive-200">
            {link}
          </code>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(link)
              setKopiert(true)
              setTimeout(() => setKopiert(false), 2000)
            }}
            className="shrink-0 rounded-xl bg-mabe-900 px-4 py-3 text-sm font-semibold text-white hover:bg-mabe-800"
          >
            {kopiert ? 'Kopiert ✓' : 'Kopieren'}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={einladungSenden}
            disabled={mailStatus === 'sendet' || mailStatus === 'ok'}
            className="self-start rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
          >
            {mailStatus === 'sendet'
              ? 'E-Mail wird gesendet …'
              : mailStatus === 'ok'
                ? 'Einladung gesendet ✓'
                : '✉️ Einladungs-E-Mail jetzt an den Kunden senden'}
          </button>
          {mailMeldung && (
            <p
              role="status"
              className={`rounded-lg px-3 py-2 text-xs font-medium break-all ${
                mailStatus === 'fehler' ? 'bg-red-50 text-red-700' : 'bg-teal-50 text-teal-800'
              }`}
            >
              {mailMeldung}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setLink(null)
              setAngebotId(null)
              setMailStatus('idle')
              setMailMeldung(null)
              setPdfDatei(null)
              setExtraktion(null)
              setAnalyseStatus('idle')
              setFormVersion((v) => v + 1)
            }}
            className="text-sm font-semibold text-teal-700 hover:underline"
          >
            Weiteres Angebot anlegen
          </button>
          <a href="/admin" className="text-sm font-semibold text-olive-600 hover:underline">
            Zur Übersicht
          </a>
        </div>
      </div>
    )
  }

  const v = formVersion // fuer stabile Keys
  const dv = (wert: string | number | null | undefined) => (wert === null || wert === undefined ? undefined : String(wert))

  return (
    <form onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-8">
      {/* ---------- Angebots-PDF: hochladen, KI liest vor ---------- */}
      <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-mabe-900">Angebots-PDF (optional, empfohlen)</h3>
        <p className="mt-1 text-sm/6 text-olive-600">
          Laden Sie das MABE-Angebot als PDF hoch – die KI liest <strong>Firma, Adresse, USt-Id, Angebotsnummer,
          Investitionssummen und Sensoranzahl</strong> automatisch aus und füllt das Formular vor. Sie prüfen die
          Werte nur noch.
        </p>

        <input
          ref={dateiInput}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) analysiere(f)
          }}
        />
        <button
          type="button"
          onClick={() => dateiInput.current?.click()}
          disabled={analyseStatus === 'laeuft'}
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-olive-300 bg-olive-50/50 px-5 py-6 text-sm font-semibold text-mabe-900 transition-colors hover:border-teal-500 hover:bg-teal-50/40 disabled:opacity-60"
        >
          {analyseStatus === 'laeuft' ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" aria-hidden />
              KI liest das Angebot … (kann bis zu 30 Sekunden dauern)
            </>
          ) : pdfDatei ? (
            <>📄 {pdfDatei.name} – andere Datei wählen</>
          ) : (
            <>📄 Angebots-PDF auswählen (max. 15 MB)</>
          )}
        </button>

        {analyseStatus === 'ok' && extraktion && (
          <div className="mt-4 rounded-xl bg-teal-50 px-4 py-3 ring-1 ring-teal-200" role="status">
            <p className="text-sm font-semibold text-teal-800">Erkannt und vorbefüllt – bitte kurz prüfen:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ERKANNT_LABEL.filter(([k]) => extraktion[k] !== null).map(([k, label]) => (
                <span key={k} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-200">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
        {analyseStatus === 'fehler' && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200" role="alert">
            {analyseFehler}
          </p>
        )}
      </section>

      <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-mabe-900">Kunde</legend>
        <div>
          <label className={labelCls} htmlFor="kunde_firma">Firma *</label>
          <input key={`${v}-kunde_firma`} id="kunde_firma" name="kunde_firma" required className={inputCls} defaultValue={dv(extraktion?.kunde_firma)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="kunde_ansprechpartner">Ansprechpartner</label>
          <input key={`${v}-kunde_ansprechpartner`} id="kunde_ansprechpartner" name="kunde_ansprechpartner" className={inputCls} defaultValue={dv(extraktion?.kunde_ansprechpartner)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="kunde_email">E-Mail des Kunden *</label>
          <input key={`${v}-kunde_email`} id="kunde_email" name="kunde_email" type="email" required className={inputCls} defaultValue={dv(extraktion?.kunde_email)} />
        </div>
        {(extraktion?.strasse || extraktion?.ust_id) && (
          <div className="rounded-xl bg-olive-50 px-4 py-3 text-xs/5 text-olive-600 ring-1 ring-olive-200 sm:col-span-2">
            Erkannt aus dem Angebot (wird dem Kunden in der Journey vorbefüllt):{' '}
            {[extraktion.strasse, [extraktion.plz, extraktion.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
            {extraktion.ust_id && ` · USt-Id ${extraktion.ust_id}`}
          </div>
        )}
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-mabe-900">Angebot (aus dem MABE-Angebot)</legend>
        <div>
          <label className={labelCls} htmlFor="angebot_nr">Angebotsnummer *</label>
          <input key={`${v}-angebot_nr`} id="angebot_nr" name="angebot_nr" required className={inputCls} defaultValue={dv(extraktion?.angebot_nr)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="angebot_datum">Angebotsdatum *</label>
          <input key={`${v}-angebot_datum`} id="angebot_datum" name="angebot_datum" type="date" required className={inputCls} defaultValue={dv(extraktion?.angebot_datum)} />
        </div>
        <div className="sm:col-span-2">
          <span className={labelCls}>Technologien *</span>
          <div className="flex flex-wrap gap-3">
            {TECHNOLOGIEN.map((t) => (
              <label
                key={t.wert}
                className={`cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-medium ${
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
        {technologien.includes('software') && (
          <>
            <div>
              <label className={labelCls} htmlFor="software_variante">Energiemanagementsoftware</label>
              <select id="software_variante" name="software_variante" className={inputCls} defaultValue="mabe_cloud">
                <option value="mabe_cloud">MABE Cloud</option>
                <option value="andere">Andere (im Gespräch klären)</option>
                <option value="offen">Noch offen</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="invest_software">Investitionskosten Software (€)</label>
              <input key={`${v}-invest_software`} id="invest_software" name="invest_software" type="number" min={0} className={inputCls} defaultValue={dv(extraktion?.invest_software)} />
            </div>
          </>
        )}
        {technologien.includes('messtechnik') && (
          <>
            <div>
              <label className={labelCls} htmlFor="sensoren_gesamt">Anzahl Sensoren (gesamt)</label>
              <input key={`${v}-sensoren_gesamt`} id="sensoren_gesamt" name="sensoren_gesamt" type="number" min={0} className={inputCls} defaultValue={dv(extraktion?.sensoren_gesamt)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="sensoren_prozessbezug">davon mit Prozessbezug</label>
              <input key={`${v}-sensoren_prozessbezug`} id="sensoren_prozessbezug" name="sensoren_prozessbezug" type="number" min={0} className={inputCls} defaultValue={dv(extraktion?.sensoren_prozessbezug)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="invest_messtechnik">Investitionskosten Mess-/Sensortechnik (€)</label>
              <input key={`${v}-invest_messtechnik`} id="invest_messtechnik" name="invest_messtechnik" type="number" min={0} className={inputCls} defaultValue={dv(extraktion?.invest_messtechnik)} />
            </div>
          </>
        )}
        {technologien.includes('steuerung') && (
          <div>
            <label className={labelCls} htmlFor="invest_steuerung">Investitionskosten Steuerungstechnik (€)</label>
            <input key={`${v}-invest_steuerung`} id="invest_steuerung" name="invest_steuerung" type="number" min={0} className={inputCls} defaultValue={dv(extraktion?.invest_steuerung)} />
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="projektende">Voraussichtliches Projektende</label>
          <input key={`${v}-projektende`} id="projektende" name="projektende" type="date" className={inputCls} defaultValue={dv(extraktion?.projektende)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="notiz">Interne Notiz</label>
          <textarea id="notiz" name="notiz" rows={2} className={inputCls} />
        </div>
      </fieldset>

      {fehler && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200" role="alert">
          {fehler}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || analyseStatus === 'laeuft'}
        className="self-start rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
      >
        {busy ? 'Wird angelegt …' : 'Angebot anlegen & Kunden-Link erzeugen'}
      </button>
    </form>
  )
}
