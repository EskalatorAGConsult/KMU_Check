'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

import { authClient } from '@/lib/auth/client'

/** Gemeinsame Formular-Bausteine der Kunden-Auth-Seiten (MABE-CI). */

export const inputCls =
  'w-full min-h-12 rounded-xl border border-olive-300 bg-white px-4 py-3 text-base text-mabe-900 placeholder:text-olive-400 ' +
  'focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30'
const labelCls = 'mb-1.5 block text-sm font-semibold text-mabe-900'

export function AuthKarte({ titel, untertitel, children }: { titel: string; untertitel: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-olive-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-semibold text-mabe-900">{titel}</h1>
        <p className="text-sm/6 text-olive-600">{untertitel}</p>
      </div>
      {children}
    </div>
  )
}

function Fehler({ text }: { text: string }) {
  return (
    <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200" role="alert">
      {text}
    </p>
  )
}

function PrimaerButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="min-h-12 w-full rounded-xl bg-mabe-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mabe-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-mabe-900/40 focus-visible:ring-offset-2 disabled:opacity-50"
    >
      {busy ? busyLabel : label}
    </button>
  )
}

/** Anmeldung fuer Bestandskunden. */
export function AnmeldenForm() {
  const router = useRouter()
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      setFehler(null)
      const { error } = await authClient.signIn.email({
        email: String(fd.get('email') ?? ''),
        password: String(fd.get('passwort') ?? ''),
      })
      if (error) {
        setFehler('Anmeldung fehlgeschlagen – bitte E-Mail und Passwort prüfen.')
        return
      }
      router.push('/konto')
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label className={labelCls} htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="passwort">Passwort</label>
        <input id="passwort" name="passwort" type="password" autoComplete="current-password" required className={inputCls} />
      </div>
      {fehler && <Fehler text={fehler} />}
      <PrimaerButton busy={busy} label="Anmelden" busyLabel="Wird angemeldet …" />
      <div className="flex flex-col gap-2 text-center text-sm">
        <Link href="/konto/passwort-vergessen" className="font-medium text-teal-700 hover:underline">
          Passwort vergessen?
        </Link>
        <p className="text-olive-500">
          Noch kein Konto?{' '}
          <Link href="/konto/registrieren" className="font-medium text-teal-700 hover:underline">
            Jetzt registrieren
          </Link>
        </p>
      </div>
    </form>
  )
}

/** Registrierung neuer Kundenkonten (Rolle 'kunde' wird serverseitig gesetzt). */
export function RegistrierenForm() {
  const router = useRouter()
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const passwort = String(fd.get('passwort') ?? '')
    if (passwort !== String(fd.get('passwort2') ?? '')) {
      setFehler('Die Passwörter stimmen nicht überein.')
      return
    }
    startTransition(async () => {
      setFehler(null)
      const { error } = await authClient.signUp.email({
        name: String(fd.get('name') ?? ''),
        email: String(fd.get('email') ?? ''),
        password: passwort,
      })
      if (error) {
        setFehler(
          error.code === 'USER_ALREADY_EXISTS'
            ? 'Zu dieser E-Mail existiert bereits ein Konto – bitte melden Sie sich an.'
            : 'Registrierung fehlgeschlagen. Bitte prüfen Sie Ihre Eingaben (Passwort mind. 12 Zeichen).',
        )
        return
      }
      router.push('/konto')
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label className={labelCls} htmlFor="name">Name</label>
        <input id="name" name="name" autoComplete="name" required className={inputCls} placeholder="Vor- und Nachname" />
      </div>
      <div>
        <label className={labelCls} htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="passwort">Passwort (mind. 12 Zeichen)</label>
        <input id="passwort" name="passwort" type="password" autoComplete="new-password" minLength={12} required className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="passwort2">Passwort wiederholen</label>
        <input id="passwort2" name="passwort2" type="password" autoComplete="new-password" minLength={12} required className={inputCls} />
      </div>
      {fehler && <Fehler text={fehler} />}
      <PrimaerButton busy={busy} label="Konto anlegen" busyLabel="Wird angelegt …" />
      <p className="text-center text-sm text-olive-500">
        Bereits registriert?{' '}
        <Link href="/konto/anmelden" className="font-medium text-teal-700 hover:underline">
          Zur Anmeldung
        </Link>
      </p>
    </form>
  )
}

/** Passwort-Reset anfordern (Mail via Resend). */
export function PasswortVergessenForm() {
  const [fehler, setFehler] = useState<string | null>(null)
  const [gesendet, setGesendet] = useState(false)
  const [busy, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      setFehler(null)
      const { error } = await authClient.requestPasswordReset({
        email: String(fd.get('email') ?? ''),
        redirectTo: '/konto/passwort-zuruecksetzen',
      })
      if (error) {
        setFehler('Die E-Mail konnte nicht angefordert werden. Bitte prüfen Sie die Adresse.')
        return
      }
      setGesendet(true)
    })
  }

  if (gesendet) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm/6 text-teal-900 ring-1 ring-teal-600/20">
          <strong>E-Mail ist unterwegs.</strong> Falls ein Konto zu dieser Adresse existiert, erhalten Sie in
          Kürze einen Link zum Zurücksetzen. Bitte prüfen Sie auch den Spam-Ordner.
        </div>
        <Link href="/konto/anmelden" className="text-center text-sm font-medium text-teal-700 hover:underline">
          Zurück zur Anmeldung
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label className={labelCls} htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputCls} />
      </div>
      {fehler && <Fehler text={fehler} />}
      <PrimaerButton busy={busy} label="Link zum Zurücksetzen senden" busyLabel="Wird gesendet …" />
      <Link href="/konto/anmelden" className="text-center text-sm font-medium text-teal-700 hover:underline">
        Zurück zur Anmeldung
      </Link>
    </form>
  )
}

/** Neues Passwort setzen (Token aus dem E-Mail-Link). */
export function PasswortZuruecksetzenForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')
  const [fehler, setFehler] = useState<string | null>(token ? null : 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.')
  const [busy, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const passwort = String(fd.get('passwort') ?? '')
    if (passwort !== String(fd.get('passwort2') ?? '')) {
      setFehler('Die Passwörter stimmen nicht überein.')
      return
    }
    startTransition(async () => {
      setFehler(null)
      const { error } = await authClient.resetPassword({ newPassword: passwort, token: token ?? '' })
      if (error) {
        setFehler('Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.')
        return
      }
      router.push('/konto/anmelden')
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label className={labelCls} htmlFor="passwort">Neues Passwort (mind. 12 Zeichen)</label>
        <input id="passwort" name="passwort" type="password" autoComplete="new-password" minLength={12} required className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="passwort2">Neues Passwort wiederholen</label>
        <input id="passwort2" name="passwort2" type="password" autoComplete="new-password" minLength={12} required className={inputCls} />
      </div>
      {fehler && <Fehler text={fehler} />}
      <PrimaerButton busy={busy} label="Passwort speichern" busyLabel="Wird gespeichert …" />
    </form>
  )
}

/** Abmelden im Kundenkonto. */
export function KontoLogoutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut()
        router.push('/konto/anmelden')
        router.refresh()
      }}
      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-olive-600 transition-colors hover:bg-olive-50"
    >
      Abmelden
    </button>
  )
}
