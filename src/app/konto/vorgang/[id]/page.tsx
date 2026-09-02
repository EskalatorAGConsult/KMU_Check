import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StatusBadge } from '@/components/konto/status-badge'
import { requireKunde } from '@/lib/auth/guards'
import { holeVorgangFuerUser } from '@/lib/db/repositories/konto'
import { CATEGORY_LABELS, formatEUR, type Category } from '@/lib/kmu'

export const metadata: Metadata = { title: 'Vorgang | MABE Förderportal', robots: { index: false } }

export const dynamic = 'force-dynamic'

function Zeile({ label, wert }: { label: string; wert: string | null | undefined }) {
  if (!wert) return null
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:justify-between sm:gap-6">
      <dt className="text-sm text-olive-600">{label}</dt>
      <dd className="text-sm font-medium break-words text-mabe-900 sm:text-right">{wert}</dd>
    </div>
  )
}

export default async function VorgangPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireKunde()
  const vorgang = await holeVorgangFuerUser(session.user.id, id)
  if (!vorgang) notFound()

  const { angebot, fortschrittProzent, stammdaten, kmu, vollmacht, deminimisSumme, dokumente } = vorgang
  const eingereicht = angebot.status === 'eingereicht' || angebot.status === 'abgeschlossen'
  const systemkonzept = dokumente.find((d) => d.typ === 'systemkonzept') ?? null
  const vollmachtDokument = dokumente.find((d) => d.typ === 'vollmacht') ?? null
  const angebotDokument = dokumente.find((d) => d.typ === 'angebot_pdf') ?? null
  const invest =
    (angebot.invest_software ?? 0) + (angebot.invest_messtechnik ?? 0) + (angebot.invest_steuerung ?? 0)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/konto" className="text-sm font-semibold text-teal-700 hover:underline">
        ← Alle Vorgänge
      </Link>

      <header className="mt-4 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-mabe-900 sm:text-3xl">{angebot.angebot_nr}</h1>
          <p className="mt-1 text-sm/6 text-olive-600">
            {angebot.kunde_firma} · Angebot vom {new Date(angebot.angebot_datum).toLocaleDateString('de-DE')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={angebot.status} />
          {eingereicht && (
            <a
              href={`/konto/vorgang/${angebot.id}/dossier`}
              className="rounded-xl border border-teal-600 bg-white px-4 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50"
            >
              Alle Daten als PDF ↓
            </a>
          )}
        </div>
      </header>

      {/* Fortschritt */}
      <section className="mb-8 rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-mabe-900">Bearbeitungsstand</h2>
          <span className="text-sm font-semibold text-teal-700 tabular-nums">{fortschrittProzent} %</span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-olive-100"
          role="progressbar"
          aria-valuenow={fortschrittProzent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Bearbeitungsstand"
        >
          <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${fortschrittProzent}%` }} />
        </div>
        {!eingereicht && (
          <p className="mt-3 text-sm/6 text-olive-600">
            Ihr Vorgang ist noch nicht vollständig eingereicht. Öffnen Sie Ihren persönlichen Link aus der
            MABE-Einladung, um fortzufahren – Ihre bisherigen Angaben sind gespeichert.
          </p>
        )}
      </section>

      {/* KMU-Ergebnis */}
      {kmu && (
        <section className="mb-8 overflow-hidden rounded-2xl bg-mabe-900 p-5 text-white sm:p-6">
          <p className="text-xs font-semibold tracking-wide text-olive-300 uppercase">
            Ihre KMU-Auswertung · Geschäftsjahr {kmu.geschaeftsjahr}
          </p>
          <p className="mt-1.5 text-xl font-semibold">
            {CATEGORY_LABELS[kmu.kategorie as Category] ?? kmu.kategorie} ·{' '}
            <span className="text-teal-300">{kmu.foerderquote_pct} % Förderquote</span>
          </p>
          {invest > 0 && (
            <p className="mt-1 text-sm text-olive-200">
              Das entspricht einem Zuschuss von bis zu{' '}
              <strong className="text-teal-300">{formatEUR((invest * kmu.foerderquote_pct) / 100)}</strong> bei einer
              Investition von {formatEUR(invest)}.
            </p>
          )}
        </section>
      )}

      {/* Eingereichte Angaben */}
      {stammdaten && (
        <section className="mb-8 rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
          <h2 className="mb-2 text-sm font-semibold text-mabe-900">Ihre eingereichten Angaben</h2>
          <dl className="divide-y divide-olive-100">
            <Zeile label="Unternehmen" wert={String(stammdaten.unternehmensname ?? '')} />
            <Zeile
              label="Adresse"
              wert={`${stammdaten.strasse ?? ''}, ${stammdaten.plz ?? ''} ${stammdaten.ort ?? ''}`}
            />
            <Zeile label="E-Mail (Unternehmen)" wert={String(stammdaten.email ?? '')} />
            <Zeile label="WZ-Code" wert={stammdaten.wz_code ? String(stammdaten.wz_code) : null} />
            <Zeile
              label="Ansprechpartner"
              wert={`${stammdaten.ap_anrede ?? ''} ${stammdaten.ap_vorname ?? ''} ${stammdaten.ap_nachname ?? ''} (${stammdaten.ap_rolle ?? ''})`}
            />
            <Zeile label="E-Mail (Ansprechpartner)" wert={stammdaten.ap_email ? String(stammdaten.ap_email) : null} />
            <Zeile label="Kontoinhaber" wert={stammdaten.kontoinhaber ? String(stammdaten.kontoinhaber) : null} />
            <Zeile label="IBAN" wert={stammdaten.iban ? String(stammdaten.iban) : null} />
          </dl>
        </section>
      )}

      {/* Beantragung & De-minimis */}
      {(vollmacht || deminimisSumme != null) && (
        <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
          <h2 className="mb-2 text-sm font-semibold text-mabe-900">Beantragung</h2>
          <dl className="divide-y divide-olive-100">
            {vollmacht && (
              <>
                <Zeile
                  label="Beantragungsweg"
                  wert={
                    vollmacht.beantragungsweg === 'eskalator'
                      ? 'Fördermittel-Concierge der Eskalator AG'
                      : 'Beantragung durch Ihr Unternehmen selbst'
                  }
                />
                {vollmacht.unterzeichnet_von && (
                  <Zeile
                    label="Vollmacht erteilt"
                    wert={`${vollmacht.unterzeichnet_von}${
                      vollmacht.unterzeichnet_at
                        ? `, ${new Date(vollmacht.unterzeichnet_at).toLocaleString('de-DE')}`
                        : ''
                    }`}
                  />
                )}
                {vollmacht.signatur_bild_path && (
                  <div className="py-2">
                    <p className="text-sm text-olive-600">Ihre gezeichnete Unterschrift</p>
                    {/* eslint-disable-next-line @next/next/no-img-element -- authentifizierter Proxy, kein optimierbares Asset */}
                    <img
                      src={`/konto/vorgang/${angebot.id}/signatur`}
                      alt="Ihre gezeichnete Unterschrift auf der Vollmacht"
                      className="mt-1 max-h-20 max-w-full rounded-lg border border-olive-200 bg-white object-contain p-1"
                    />
                  </div>
                )}
              </>
            )}
            {deminimisSumme != null && (
              <Zeile label="De-minimis-Beihilfen (3 Jahre)" wert={formatEUR(deminimisSumme)} />
            )}
          </dl>
        </section>
      )}

      {/* Einreichungs-Übersicht */}
      {eingereicht && (
        <section className="mt-8 rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
          <h2 className="mb-1 text-sm font-semibold text-mabe-900">Das reichen wir für Sie ein</h2>
          <p className="mb-3 text-xs/5 text-olive-600">
            Übersicht aller Unterlagen, die für Ihren Antrag im BAFA-Programm „Energieeffizienz in der
            Wirtschaft“, Modul 3, vorbereitet sind.
          </p>
          <ul className="divide-y divide-olive-100">
            {[
              { titel: 'Förderantrag mit Ihren Stammdaten', hinweis: 'wird im FZD-Portal gestellt' },
              { titel: 'KMU-Erklärung nach EU-Empfehlung 2003/361/EG', hinweis: null as string | null },
              { titel: 'De-minimis-Erklärung', hinweis: null as string | null },
            ].map((d) => (
              <li key={d.titel} className="flex items-start gap-3 py-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white"
                >
                  ✓
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words text-mabe-900">{d.titel}</p>
                  {d.hinweis && <p className="text-xs/5 text-olive-500">{d.hinweis}</p>}
                </div>
              </li>
            ))}
            <li className="flex items-start gap-3 py-2.5">
              <span
                aria-hidden
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  systemkonzept ? 'bg-teal-600 text-white' : 'bg-olive-200 text-olive-600'
                }`}
              >
                {systemkonzept ? '✓' : '…'}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium break-words text-mabe-900">Systemkonzept (MABE smart control)</p>
                {systemkonzept ? (
                  <a
                    href={`/konto/vorgang/${angebot.id}/dokument/${systemkonzept.id}`}
                    className="text-xs font-semibold text-teal-700 hover:underline"
                  >
                    PDF herunterladen ↓
                  </a>
                ) : (
                  <p className="text-xs/5 text-olive-500">wird derzeit erstellt</p>
                )}
              </div>
            </li>
            {angebotDokument && (
              <li className="flex items-start gap-3 py-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white"
                >
                  ✓
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words text-mabe-900">Ihr Angebot (PDF)</p>
                  <a
                    href={`/konto/vorgang/${angebot.id}/dokument/${angebotDokument.id}`}
                    className="text-xs font-semibold text-teal-700 hover:underline"
                  >
                    PDF herunterladen ↓
                  </a>
                </div>
              </li>
            )}
            {vollmacht?.beantragungsweg === 'eskalator' && (
              <li className="flex items-start gap-3 py-2.5">
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    vollmachtDokument ? 'bg-teal-600 text-white' : 'bg-olive-200 text-olive-600'
                  }`}
                >
                  {vollmachtDokument ? '✓' : '…'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words text-mabe-900">
                    Vollmacht für die WissensReich Academy UG (BAFA-Formular eew_vm_3)
                  </p>
                  {vollmachtDokument ? (
                    <a
                      href={`/konto/vorgang/${angebot.id}/dokument/${vollmachtDokument.id}`}
                      className="text-xs font-semibold text-teal-700 hover:underline"
                    >
                      Ausgefülltes PDF herunterladen ↓
                    </a>
                  ) : (
                    <p className="text-xs/5 text-olive-500">elektronisch erteilt · PDF wird derzeit erstellt</p>
                  )}
                </div>
              </li>
            )}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs/5 text-olive-500">
        Bei Änderungswünschen an eingereichten Angaben wenden Sie sich bitte an Ihren MABE-Ansprechpartner.
      </p>
    </main>
  )
}
