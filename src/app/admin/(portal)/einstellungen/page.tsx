import type { Metadata } from 'next'

import { WebhookForm } from '@/components/admin/webhook-form'
import { holeEinstellung } from '@/lib/db/repositories/einstellungen'
import { loeseWebhookAuf } from '@/lib/webhook'

export const metadata: Metadata = { title: 'Einstellungen | MABE Förderportal', robots: { index: false } }
export const dynamic = 'force-dynamic'

const QUELLEN_LABEL: Record<string, string> = {
  datenbank: 'Individuell (Einstellungen)',
  umgebung: 'ENV-Fallback (WEBHOOK_URL aus Vercel)',
  keine: 'Nicht konfiguriert',
}

/** URL fuer die Anzeige maskieren (Host sichtbar, Pfad gekuerzt). */
function maskiere(url: string): string {
  try {
    const u = new URL(url)
    const pfad = u.pathname.length > 24 ? `${u.pathname.slice(0, 24)}…` : u.pathname
    return `${u.origin}${pfad}`
  } catch {
    return url
  }
}

export default async function EinstellungenPage() {
  const dbWert = (await holeEinstellung('webhook_url')) ?? ''
  const aufloesung = loeseWebhookAuf(dbWert, process.env.WEBHOOK_URL)

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-mabe-900">Einstellungen</h2>
        <p className="mt-1 text-sm/6 text-olive-600">
          Zentrale Konfiguration des Portals. Änderungen wirken sofort, ohne Redeploy.
        </p>
      </div>

      <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-mabe-900">Lead-/Übergabe-Webhook</h3>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              aufloesung.quelle === 'keine' ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-800'
            }`}
          >
            {QUELLEN_LABEL[aufloesung.quelle]}
          </span>
        </div>

        {aufloesung.url ? (
          <p className="mb-4 text-sm text-olive-600">
            Wirksame URL: <code className="rounded bg-olive-100 px-1.5 py-0.5 text-xs">{maskiere(aufloesung.url)}</code>
          </p>
        ) : (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Aktuell ist keine Webhook-URL konfiguriert. Leads und Journey-Übergaben werden angenommen, aber
            nicht weitergeleitet.
          </p>
        )}

        <WebhookForm initialUrl={dbWert} />
      </section>
    </div>
  )
}
