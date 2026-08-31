import type { Metadata } from 'next'

import { AngebotForm } from '@/components/admin/angebot-form'

export const metadata: Metadata = { title: 'Neues Angebot | MABE Förderportal', robots: { index: false } }

export default function NeuesAngebotPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-mabe-900">Neues Angebot anlegen</h2>
        <p className="mt-1 text-sm text-olive-600">
          Nach dem Anlegen erzeugt das System automatisch den persönlichen Link für den Kunden.
        </p>
      </div>
      <AngebotForm />
    </div>
  )
}
