import type { Metadata } from 'next'

import { LoginForm } from '@/components/admin/login-form'

export const metadata: Metadata = {
  title: 'Vertriebs-Login | MABE Förderportal',
  robots: { index: false, follow: false },
}

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-8 px-6 py-24">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">MABE Förderportal</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-mabe-900">Vertriebs-Login</h1>
        <p className="mt-2 text-sm text-olive-600">Nur für autorisierte MABE-Mitarbeitende.</p>
      </div>
      <LoginForm />
    </main>
  )
}
