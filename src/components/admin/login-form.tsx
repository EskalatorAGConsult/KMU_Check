'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { authClient } from '@/lib/auth/client'

const inputCls =
  'w-full rounded-xl border border-olive-300 bg-white px-4 py-3 text-base text-mabe-900 ' +
  'focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setFehler(null)
      const { error } = await authClient.signIn.email({ email, password: passwort })
      if (error) {
        setFehler('Anmeldung fehlgeschlagen – bitte E-Mail und Passwort prüfen.')
        return
      }
      router.push('/admin')
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-mabe-900">
          E-Mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="passwort" className="mb-1.5 block text-sm font-semibold text-mabe-900">
          Passwort
        </label>
        <input
          id="passwort"
          type="password"
          autoComplete="current-password"
          required
          className={inputCls}
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
        />
      </div>
      {fehler && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200" role="alert">
          {fehler}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-mabe-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-mabe-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90 disabled:opacity-50"
      >
        {busy ? 'Anmelden …' : 'Anmelden'}
      </button>
      <p className="text-center text-sm">
        <Link
          href="/admin/login/passwort-vergessen"
          className="font-medium text-teal-700 hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 active:brightness-90"
        >
          Passwort vergessen?
        </Link>
      </p>
    </form>
  )
}
