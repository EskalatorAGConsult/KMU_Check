'use client'

import { useState, useTransition } from 'react'

import {
  aendereRolleAction,
  ladeBenutzerEin,
  widerrufeEinladungAction,
} from '@/lib/admin/benutzer-actions'
import { ROLLEN_LABEL, SETZBARE_ROLLEN } from '@/lib/admin/rollen'
import type { Benutzer, BenutzerEinladung } from '@/lib/db/repositories/benutzer'

const ROLLEN_BADGE: Record<string, string> = {
  admin: 'bg-mabe-100 text-mabe-800',
  eskalator: 'bg-purple-100 text-purple-800',
  vertrieb: 'bg-teal-100 text-teal-800',
  kunde: 'bg-olive-100 text-olive-700',
  deaktiviert: 'bg-red-100 text-red-700',
}

export function BenutzerVerwaltung({
  benutzer,
  einladungen,
  eigeneUserId,
  appUrl,
}: {
  benutzer: Benutzer[]
  einladungen: BenutzerEinladung[]
  eigeneUserId: string
  appUrl: string
}) {
  const [email, setEmail] = useState('')
  const [rolle, setRolle] = useState('vertrieb')
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const einladen = () => {
    setMeldung(null)
    startTransition(async () => {
      const res = await ladeBenutzerEin(email, rolle)
      if (res.ok) {
        setEmail('')
        setMeldung({
          art: 'ok',
          text: res.link ? `${res.hinweis} Link: ${appUrl}${res.link}` : res.hinweis,
        })
      } else {
        setMeldung({ art: 'fehler', text: res.fehler })
      }
    })
  }

  const aktion = (fn: () => Promise<{ ok: true; hinweis: string } | { ok: false; fehler: string }>) => {
    setMeldung(null)
    startTransition(async () => {
      const res = await fn()
      setMeldung(res.ok ? { art: 'ok', text: res.hinweis } : { art: 'fehler', text: res.fehler })
    })
  }

  const offeneEinladungen = einladungen.filter((e) => !e.used_at && !e.revoked_at)

  return (
    <div className="flex flex-col gap-8">
      {/* Einladung */}
      <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
        <h3 className="mb-1 text-sm font-semibold text-mabe-900">Teammitglied einladen</h3>
        <p className="mb-4 text-xs/5 text-olive-600">
          Der Eingeladene erhält einen Link (14 Tage gültig, einmalig einlösbar) und legt damit selbst Name und
          Passwort fest. Kundenkonten entstehen nicht hier, sondern über die öffentliche Registrierung.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail des Teammitglieds"
            aria-label="E-Mail des Teammitglieds"
            className="w-full rounded-xl border border-olive-300 px-4 py-3 text-base text-mabe-900 placeholder:text-olive-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 focus:outline-none sm:text-sm"
          />
          <select
            value={rolle}
            onChange={(e) => setRolle(e.target.value)}
            aria-label="Rolle"
            className="rounded-xl border border-olive-300 bg-white px-4 py-3 text-sm text-mabe-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 focus:outline-none"
          >
            <option value="admin">Administrator (MABE)</option>
            <option value="eskalator">Administrator (Eskalator AG)</option>
            <option value="vertrieb">Vertrieb (MABE)</option>
          </select>
          <button
            type="button"
            onClick={einladen}
            disabled={pending || !email}
            className="shrink-0 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
          >
            Einladen
          </button>
        </div>
      </section>

      {meldung && (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-medium break-words ${
            meldung.art === 'ok' ? 'bg-teal-50 text-teal-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {meldung.text}
        </p>
      )}

      {/* Offene Einladungen */}
      {offeneEinladungen.length > 0 && (
        <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-mabe-900">Offene Einladungen ({offeneEinladungen.length})</h3>
          <ul className="divide-y divide-olive-100">
            {offeneEinladungen.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-mabe-900">{e.email}</p>
                  <p className="text-xs text-olive-500">
                    {ROLLEN_LABEL[e.rolle] ?? e.rolle} · gültig bis {new Date(e.expires_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => aktion(() => widerrufeEinladungAction(e.id))}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Widerrufen
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Benutzerliste */}
      <section className="overflow-x-auto rounded-2xl ring-1 ring-olive-200">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-olive-50 text-olive-500">
              <th className="px-5 py-3.5 font-semibold">Benutzer</th>
              <th className="px-5 py-3.5 font-semibold">Rolle</th>
              <th className="px-5 py-3.5 font-semibold">Seit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive-100 bg-white">
            {benutzer.map((b) => (
              <tr key={b.id}>
                <td className="px-5 py-3.5">
                  <div className="font-medium text-mabe-900">
                    {b.name}
                    {b.id === eigeneUserId && <span className="ml-2 text-xs font-normal text-olive-500">(Sie)</span>}
                  </div>
                  <div className="text-xs text-olive-500">{b.email}</div>
                </td>
                <td className="px-5 py-3.5">
                  {b.id === eigeneUserId ? (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLLEN_BADGE[b.role] ?? 'bg-olive-100 text-olive-700'}`}>
                      {ROLLEN_LABEL[b.role] ?? b.role}
                    </span>
                  ) : (
                    <select
                      value={b.role}
                      disabled={pending}
                      onChange={(e) => aktion(() => aendereRolleAction(b.id, e.target.value))}
                      aria-label={`Rolle von ${b.email}`}
                      className="min-h-10 rounded-lg border border-olive-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-mabe-900 focus:border-teal-600 focus:outline-none disabled:opacity-50"
                    >
                      {SETZBARE_ROLLEN.map((r) => (
                        <option key={r} value={r}>
                          {ROLLEN_LABEL[r] ?? r}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-5 py-3.5 text-olive-500">
                  {new Date(b.createdAt).toLocaleDateString('de-DE')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
