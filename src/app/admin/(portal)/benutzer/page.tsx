import type { Metadata } from 'next'

import { BenutzerVerwaltung } from '@/components/admin/benutzer-verwaltung'
import { requireAdmin } from '@/lib/auth/guards'
import { listeBenutzer, listeEinladungen } from '@/lib/db/repositories/benutzer'

export const metadata: Metadata = { title: 'Benutzer | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function BenutzerPage() {
  const session = await requireAdmin()
  const [benutzer, einladungen] = await Promise.all([listeBenutzer(), listeEinladungen()])
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-mabe-900">Benutzerverwaltung</h2>
        <p className="mt-1 text-sm/6 text-olive-600">
          Teamkonten von MABE und Eskalator AG verwalten, Rollen vergeben, Einladungen versenden.
        </p>
      </div>
      <BenutzerVerwaltung
        benutzer={benutzer}
        einladungen={einladungen}
        eigeneUserId={session.user.id}
        appUrl={appUrl}
      />
    </div>
  )
}
