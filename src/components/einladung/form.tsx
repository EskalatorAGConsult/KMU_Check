'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { nehmeEinladungAn } from '@/lib/einladung/actions'

/** Formular zum Annehmen einer Team-Einladung (Name + Passwort festlegen). */
export function EinladungForm({ token, email, rolleLabel }: { token: string; email: string; rolleLabel: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const absenden = () => {
    setFehler(null)
    if (password !== password2) {
      setFehler('Die Passwörter stimmen nicht überein.')
      return
    }
    startTransition(async () => {
      const res = await nehmeEinladungAn({ token, name, password })
      if (res.ok) {
        router.push('/admin/login?erstellt=1')
      } else {
        setFehler(res.fehler)
      }
    })
  }

  const inputCls =
    'w-full rounded-xl border border-olive-300 bg-white px-4 py-3 text-base text-mabe-900 placeholder:text-olive-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 focus:outline-none sm:text-sm'

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-olive-50 px-4 py-3 text-sm text-olive-700">
        Konto für <strong>{email}</strong> · Rolle: <strong>{rolleLabel}</strong>
      </p>
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-mabe-900">
          Ihr vollständiger Name
        </label>
        <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div>
        <label htmlFor="pw" className="mb-1.5 block text-sm font-semibold text-mabe-900">
          Passwort (mindestens 12 Zeichen)
        </label>
        <input
          id="pw"
          type="password"
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label htmlFor="pw2" className="mb-1.5 block text-sm font-semibold text-mabe-900">
          Passwort wiederholen
        </label>
        <input
          id="pw2"
          type="password"
          className={inputCls}
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      {fehler && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {fehler}
        </p>
      )}
      <button
        type="button"
        onClick={absenden}
        disabled={pending || !name || !password}
        className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
      >
        {pending ? 'Konto wird angelegt …' : 'Konto anlegen'}
      </button>
    </div>
  )
}
