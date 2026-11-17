import type { ReactNode } from 'react'

import { BescheidManager } from '@/components/bescheid/bescheid-manager'
import { NachweisManager } from '@/components/bescheid/nachweis-manager'
import { NachweisKontext } from '@/lib/bescheid/domain'
import type { BescheidRow, VerwendungsnachweisRow, VnwBelegRow } from '@/lib/db/types'
import type { BescheidAnalyse } from '@/lib/gemini/bescheid-analyse'

/**
 * Admin-Sicht der Bewilligungsstationen (Fallakte): kompakte Kacheln für
 * Bescheid-Status, Frist-Ampel und VNW-Zusammenfassung plus die
 * Wiederverwendeten Manager-Komponenten (Upload/Bestätigen/Belege laufen
 * über dieselben, autorisierten Server Actions – Admin-Rolle erkannt der
 * Zugriffs-Guard automatisch).
 */
export function BescheidVerwaltung({
  angebotId,
  bescheid,
  verwendungsnachweis,
  vnwBelege,
}: {
  angebotId: string
  bescheid: BescheidRow | null
  verwendungsnachweis: VerwendungsnachweisRow | null
  vnwBelege: VnwBelegRow[]
}) {
  const ocr = (bescheid?.ocr ?? null) as BescheidAnalyse | null
  const kontext = new NachweisKontext({ bescheid, vnw: verwendungsnachweis, belege: vnwBelege })

  return (
    <div className="flex flex-col gap-6">
      <Kachelreihe>
        <Kachel
          label="Zuwendungsbescheid"
          wert={
            bescheid?.bestaetigt_am
              ? 'bestätigt'
              : bescheid
                ? 'hochgeladen (unbestätigt)'
                : 'noch nicht hochgeladen'
          }
          farbe={bescheid?.bestaetigt_am ? 'ok' : bescheid ? 'warn' : 'neutral'}
        />
        <Kachel
          label="VNW-Vorlagefrist"
          wert={
            kontext.wirksameFrist
              ? new Date(`${kontext.wirksameFrist}T00:00:00`).toLocaleDateString('de-DE')
              : 'nicht erfasst'
          }
          farbe={kontext.frist.status === 'ueberfaellig' ? 'fehler' : kontext.frist.status === 'knapp' ? 'warn' : 'neutral'}
          hinweis={
            kontext.frist.tageRest != null && kontext.frist.status !== 'eingereicht'
              ? `${kontext.frist.tageRest} Tag(e) ${kontext.frist.tageRest >= 0 ? 'restlich' : 'über Frist'}`
              : undefined
          }
        />
        <Kachel
          label="Verwendungsnachweis"
          wert={
            verwendungsnachweis?.status === 'eingereicht'
              ? 'eingereicht'
              : vnwBelege.length > 0
                ? `${vnwBelege.length} Beleg(e)`
                : 'offen'
          }
          farbe={verwendungsnachweis?.status === 'eingereicht' ? 'ok' : 'neutral'}
        />
      </Kachelreihe>

      {/* Dieselben Stationen wie beim Kunden – der Zugriffs-Guard der Actions
          erkennt die Admin-Rolle; Downloads laufen über die Admin-Proxy-Route. */}
      <details className="rounded-2xl border border-olive-200 bg-white p-5" open={!bescheid}>
        <summary className="cursor-pointer text-sm font-semibold text-mabe-900">
          Bescheid-Station (Upload, OCR prüfen, Zeitraum & Frist)
        </summary>
        <div className="mt-4">
          <BescheidManager
            angebotId={angebotId}
            bescheid={bescheid}
            ocrStart={ocr}
            dokumentId={null}
            downloadBasis="/admin/dokument"
          />
        </div>
      </details>

      {kontext.stationenAktiv && (
        <details className="rounded-2xl border border-olive-200 bg-white p-5" open={verwendungsnachweis?.status !== 'eingereicht'}>
          <summary className="cursor-pointer text-sm font-semibold text-mabe-900">
            Verwendungsnachweis-Station (Belege, Sachbericht, Einreichung)
          </summary>
          <div className="mt-4">
            <NachweisManager
              angebotId={angebotId}
              vnw={verwendungsnachweis}
              belege={vnwBelege.map((b) => ({
                ...b,
                dokument: { id: b.dokument_id, storage_path: b.dokument_id, created_at: b.created_at },
              }))}
              frist={kontext.frist}
              belegSummeEur={kontext.belegSummeEur}
              fehlendeBausteine={kontext.fehlendeBausteine}
              darfEinreichen={kontext.darfEinreichen}
              downloadBasis="/admin/dokument"
            />
          </div>
        </details>
      )}
    </div>
  )
}

function Kachelreihe({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>
}

function Kachel({
  label,
  wert,
  farbe,
  hinweis,
}: {
  label: string
  wert: string
  farbe: 'ok' | 'warn' | 'fehler' | 'neutral'
  hinweis?: string
}) {
  const cls =
    farbe === 'ok'
      ? 'border-teal-300 bg-teal-50'
      : farbe === 'warn'
        ? 'border-amber-300 bg-amber-50'
        : farbe === 'fehler'
          ? 'border-red-300 bg-red-50'
          : 'border-olive-200 bg-white'
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`} title={hinweis}>
      <p className="text-xs font-semibold text-olive-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-mabe-900">{wert}</p>
      {hinweis && <p className="mt-0.5 text-xs text-olive-500">{hinweis}</p>}
    </div>
  )
}
