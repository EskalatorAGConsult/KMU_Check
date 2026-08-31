'use client'

import { useState, useTransition } from 'react'

import { erstelleAngebotAction } from '@/lib/admin/actions'
import type { Technologie } from '@/lib/db/types'

const inputCls =
  'w-full rounded-xl border border-olive-300 bg-white px-4 py-3 text-base text-mabe-900 placeholder:text-olive-400 ' +
  'focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30'
const labelCls = 'mb-1.5 block text-sm font-semibold text-mabe-900'

const TECHNOLOGIEN: { wert: Technologie; label: string }[] = [
  { wert: 'software', label: 'Energiemanagementsoftware' },
  { wert: 'messtechnik', label: 'Mess- und Sensortechnik' },
  { wert: 'steuerung', label: 'Steuerungs- und Regelungstechnik' },
]

export function AngebotForm() {
  const [technologien, setTechnologien] = useState<Technologie[]>(['messtechnik'])
  const [fehler, setFehler] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [kopiert, setKopiert] = useState(false)
  const [busy, startTransition] = useTransition()

  const toggleTech = (t: Technologie) =>
    setTechnologien((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

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
      })
      if (!res.ok) {
        setFehler(res.fehler)
        return
      }
      setLink(`${window.location.origin}${res.link}`)
    })
  }

  if (link) {
    return (
      <div className="flex max-w-2xl flex-col gap-5 rounded-2xl border border-teal-600/30 bg-teal-50/50 p-8">
        <h2 className="text-lg font-semibold text-mabe-900">Angebot angelegt – Kunden-Link bereit ✅</h2>
        <p className="text-sm/6 text-olive-700">
          Senden Sie diesen Link an Ihren Kunden. Er ist <strong>90 Tage</strong> gültig und führt direkt in die
          persönliche Förder-Journey:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-xl bg-white px-4 py-3 text-sm text-mabe-900 ring-1 ring-olive-200">
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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setLink(null)}
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

  return (
    <form onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-8">
      <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-mabe-900">Kunde</legend>
        <div>
          <label className={labelCls} htmlFor="kunde_firma">Firma *</label>
          <input id="kunde_firma" name="kunde_firma" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="kunde_ansprechpartner">Ansprechpartner</label>
          <input id="kunde_ansprechpartner" name="kunde_ansprechpartner" className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="kunde_email">E-Mail des Kunden *</label>
          <input id="kunde_email" name="kunde_email" type="email" required className={inputCls} />
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-mabe-900">Angebot (aus dem MABE-Angebot)</legend>
        <div>
          <label className={labelCls} htmlFor="angebot_nr">Angebotsnummer *</label>
          <input id="angebot_nr" name="angebot_nr" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="angebot_datum">Angebotsdatum *</label>
          <input id="angebot_datum" name="angebot_datum" type="date" required className={inputCls} />
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
              <input id="invest_software" name="invest_software" type="number" min={0} className={inputCls} />
            </div>
          </>
        )}
        {technologien.includes('messtechnik') && (
          <>
            <div>
              <label className={labelCls} htmlFor="sensoren_gesamt">Anzahl Sensoren (gesamt)</label>
              <input id="sensoren_gesamt" name="sensoren_gesamt" type="number" min={0} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="sensoren_prozessbezug">davon mit Prozessbezug</label>
              <input id="sensoren_prozessbezug" name="sensoren_prozessbezug" type="number" min={0} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="invest_messtechnik">Investitionskosten Mess-/Sensortechnik (€)</label>
              <input id="invest_messtechnik" name="invest_messtechnik" type="number" min={0} className={inputCls} />
            </div>
          </>
        )}
        {technologien.includes('steuerung') && (
          <div>
            <label className={labelCls} htmlFor="invest_steuerung">Investitionskosten Steuerungstechnik (€)</label>
            <input id="invest_steuerung" name="invest_steuerung" type="number" min={0} className={inputCls} />
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="projektende">Voraussichtliches Projektende</label>
          <input id="projektende" name="projektende" type="date" className={inputCls} />
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
        disabled={busy}
        className="self-start rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
      >
        {busy ? 'Wird angelegt …' : 'Angebot anlegen & Kunden-Link erzeugen'}
      </button>
    </form>
  )
}
