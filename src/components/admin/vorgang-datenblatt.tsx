import type { ReactNode } from 'react'

import { DatenKopierenButton } from '@/components/admin/daten-kopieren-button'
import { SystemkonzeptAktionen } from '@/components/admin/systemkonzept-aktionen'
import { VorgangAktionen } from '@/components/admin/vorgang-aktionen'
import { baueDossierText } from '@/lib/admin/dossier-text'
import type { SystemkonzeptVorlage } from '@/lib/admin/systemkonzept-actions'
import type { KundeVorgang } from '@/lib/db/repositories/kunden'
import type { AngebotStatus } from '@/lib/db/types'
import { SCHRITTE } from '@/lib/journey/schritte'
import { CATEGORY_LABELS, formatEUR, type Category, type KmuResult } from '@/lib/kmu'
import {
  ANGEBOT_STATUS_LABELS,
  BEANTRAGUNGSWEG_LABELS,
  BEIHILFE_FORM_LABELS,
  BEIHILFE_STATUS_LABELS,
  DOKUMENT_TYP_LABELS,
  GRUPPENZUGEHOERIGKEIT_LABELS,
  PERSONENART_LABELS,
  SOFTWARE_VARIANTE_LABELS,
  TECHNOLOGIE_LABELS,
  UNTERNEHMENSART_LABELS,
} from '@/lib/labels'

/**
 * Vollstaendiges Datenblatt eines Vorgangs fuer den Admin-Arbeitsplatz:
 * alle eingereichten Kundendaten in der Reihenfolge des BAFA-Modul-3-
 * Formulars, plus Entwuerfe, Dokumente, Webhook-Uebergaben und Audit-Trail.
 * Server Component – keine clientseitige Logik ausser den Aktions-Buttons.
 */

const STATUS_CLS: Record<AngebotStatus, string> = {
  angelegt: 'bg-olive-100 text-olive-700',
  eingeladen: 'bg-mabe-100 text-mabe-800',
  in_bearbeitung: 'bg-amber-100 text-amber-800',
  eingereicht: 'bg-teal-100 text-teal-800',
  abgeschlossen: 'bg-teal-600 text-white',
  widerrufen: 'bg-red-100 text-red-700',
}

const fehlt = '–'
const eur = (v: number | null | undefined) => (v == null ? fehlt : formatEUR(v))
const fmtDatum = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('de-DE') : fehlt)
const fmtZeit = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('de-DE') : fehlt)
const jaNein = (v: boolean | null | undefined) => (v == null ? fehlt : v ? 'ja' : 'nein')

function Zeile({ label, wert, mono = false }: { label: string; wert: ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-sm text-olive-600">{label}</dt>
      <dd
        className={`text-sm font-medium break-words text-mabe-900 select-text sm:text-right ${
          mono ? 'font-mono text-[13px] break-all' : ''
        }`}
      >
        {wert}
      </dd>
    </div>
  )
}

function Sektion({ titel, hinweis, children }: { titel: string; hinweis?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-mabe-900">{titel}</h3>
      {hinweis && <p className="mt-0.5 text-xs/5 text-olive-500">{hinweis}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Untertitel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 mb-1 text-xs font-semibold tracking-wide text-olive-500 uppercase first:mt-0">{children}</p>
  )
}

function LeerHinweis({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-olive-300 bg-olive-50/50 px-4 py-3 text-sm text-olive-600">
      {children}
    </p>
  )
}

/** Feld-Labels der Entwurfsdaten: generische Schritte aus schritte.ts + fachliche Schritte. */
const ENTWURF_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {
    jahre: 'Geschäftsjahre',
    geschaeftsjahr: 'Geschäftsjahr',
    abgeschlossen: 'Abgeschlossenes Geschäftsjahr',
    jae: 'Beschäftigte (JAE)',
    umsatz: 'Jahresumsatz',
    bilanzsumme: 'Jahresbilanz',
    hat_beteiligungen: 'Beteiligungsverhältnisse vorhanden',
    beteiligungen: 'Partner-/verbundene Unternehmen',
    name: 'Name',
    richtung: 'Beteiligungsrichtung',
    anteil_pct: 'Beteiligung in %',
    quelle: 'Quelle',
    stufe: 'Kettentiefe',
    pfad: 'Beteiligungskette',
    beihilfen: 'De-minimis-Beihilfen',
    beihilfegeber: 'Beihilfegeber',
    aktenzeichen: 'Aktenzeichen',
    bewilligt_am: 'Bewilligt am',
    betrag: 'Betrag',
    form: 'Förderform',
    kategorie: 'Kategorie',
    status: 'Status',
    fusion_3j: 'Fusion (3 Jahre)',
    uebernahme_3j: 'Unternehmensübernahme (3 Jahre)',
    aufspaltung_3j: 'Aufspaltung (3 Jahre)',
    bestaetigt: 'Vollständigkeit bestätigt',
    beantragungsweg: 'Beantragungsweg',
    unterschrift_name: 'Unterschrift (Name)',
    vorhaben_nicht_begonnen: 'Vorhaben noch nicht begonnen',
    wahrheitsgemaess: 'Angaben wahrheitsgemäß',
    dsgvo: 'DSGVO-Einwilligung',
  }
  for (const schritt of SCHRITTE) {
    for (const feld of schritt.felder ?? []) map[feld.name] = feld.label
  }
  return map
})()

function EntwurfWert({ feld, wert }: { feld: string; wert: unknown }) {
  if (wert === undefined || wert === null || wert === '') return null
  const label = ENTWURF_LABELS[feld] ?? feld
  if (typeof wert === 'boolean') {
    return <Zeile label={label} wert={wert ? 'ja' : 'nein'} />
  }
  if (typeof wert === 'number') {
    const istGeld = ['umsatz', 'bilanzsumme', 'betrag'].includes(feld)
    return <Zeile label={label} wert={istGeld ? formatEUR(wert) : wert.toLocaleString('de-DE')} />
  }
  if (typeof wert === 'object') {
    return (
      <div className="py-2">
        <p className="text-sm text-olive-600">{label}</p>
        <pre className="mt-1 overflow-x-auto rounded-lg bg-olive-50 p-3 text-xs/5 whitespace-pre-wrap text-mabe-900">
          {JSON.stringify(wert, null, 2)}
        </pre>
      </div>
    )
  }
  return <Zeile label={label} wert={String(wert)} />
}

export function VorgangDatenblatt({
  vorgang: v,
  vorlagen,
}: {
  vorgang: KundeVorgang
  vorlagen: SystemkonzeptVorlage[]
}) {
  const a = v.angebot
  const sd = v.stammdaten
  const kmuAktuell = v.kmuBewertungen[0] ?? null
  const berechnung = (kmuAktuell?.berechnung ?? null) as KmuResult | null
  const invest = (a.invest_software ?? 0) + (a.invest_messtechnik ?? 0) + (a.invest_steuerung ?? 0)
  const zuschuss = kmuAktuell?.foerderquote_pct ? (invest * kmuAktuell.foerderquote_pct) / 100 : null
  const eingereicht = !!sd

  return (
    <article className="flex flex-col gap-5">
      {/* Kopf: Vorgang, Status, Kennzahlen, Kopier-Aktion */}
      <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-semibold text-mabe-900">{a.angebot_nr}</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[a.status]}`}>
                {ANGEBOT_STATUS_LABELS[a.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-olive-600">
              Angebot vom {fmtDatum(a.angebot_datum)} · angelegt am {fmtDatum(a.created_at)}
            </p>
          </div>
          <DatenKopierenButton text={baueDossierText(v)} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-olive-50 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold tracking-wide text-olive-500 uppercase">Investition</p>
            <p className="mt-0.5 text-sm font-semibold text-mabe-900 tabular-nums">
              {invest > 0 ? formatEUR(invest) : fehlt}
            </p>
          </div>
          <div className="rounded-xl bg-olive-50 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold tracking-wide text-olive-500 uppercase">KMU-Einstufung</p>
            <p className="mt-0.5 text-sm font-semibold text-mabe-900">
              {kmuAktuell?.kategorie
                ? (CATEGORY_LABELS[kmuAktuell.kategorie as Category] ?? kmuAktuell.kategorie)
                : 'offen'}
            </p>
          </div>
          <div className="rounded-xl bg-olive-50 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold tracking-wide text-olive-500 uppercase">Förderquote</p>
            <p className="mt-0.5 text-sm font-semibold text-teal-700 tabular-nums">
              {kmuAktuell?.foerderquote_pct ? `${kmuAktuell.foerderquote_pct} %` : fehlt}
            </p>
          </div>
          <div className="rounded-xl bg-teal-50 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold tracking-wide text-teal-700 uppercase">Voraussichtl. Zuschuss</p>
            <p className="mt-0.5 text-sm font-semibold text-teal-800 tabular-nums">
              {zuschuss != null ? formatEUR(zuschuss) : fehlt}
            </p>
          </div>
        </div>
      </section>

      {/* BAFA 7 · Technische Maßnahme (aus dem Angebot) */}
      <Sektion
        titel="Technische Maßnahme (BAFA Abschnitt 7)"
        hinweis="Stammt aus dem MABE-Angebot – vom Vertrieb erfasst bzw. per KI aus dem Angebots-PDF vorbefüllt."
      >
        <dl className="divide-y divide-olive-100">
          <Zeile label="Technologien" wert={a.technologien.map((t) => TECHNOLOGIE_LABELS[t]).join(', ')} />
          {a.software_variante && (
            <Zeile label="Software-Variante" wert={SOFTWARE_VARIANTE_LABELS[a.software_variante]} />
          )}
          {a.invest_software != null && (
            <Zeile label="Investitionskosten Energiemanagementsoftware" wert={eur(a.invest_software)} />
          )}
          {a.invest_messtechnik != null && (
            <Zeile label="Investitionskosten Mess- und Sensortechnik" wert={eur(a.invest_messtechnik)} />
          )}
          {a.invest_steuerung != null && (
            <Zeile label="Investitionskosten Steuerungs- und Regelungstechnik" wert={eur(a.invest_steuerung)} />
          )}
          <Zeile label="Anzahl beantragter Sensoren" wert={a.sensoren_gesamt ?? fehlt} />
          <Zeile label="davon mit Prozessbezug" wert={a.sensoren_prozessbezug ?? fehlt} />
          <Zeile label="Voraussichtliches Projektende" wert={fmtDatum(a.projektende)} />
          {a.notiz && <Zeile label="Notiz (Vertrieb)" wert={a.notiz} />}
        </dl>
        {a.extraktion && (
          <details className="mt-3 rounded-xl border border-olive-200 bg-olive-50/40 px-4 py-2.5">
            <summary className="cursor-pointer text-xs font-semibold text-olive-600">
              KI-Extraktion aus dem Angebots-PDF
              {a.extrahiert_am ? ` (vom ${fmtZeit(a.extrahiert_am)})` : ''}
              {a.extraktion_bestaetigt ? ' · vom Vertrieb bestätigt' : ''}
            </summary>
            <dl className="mt-2 divide-y divide-olive-100">
              {Object.entries(a.extraktion).map(([schluessel, wert]) => (
                <Zeile key={schluessel} label={schluessel} wert={wert == null ? fehlt : String(wert)} />
              ))}
            </dl>
          </details>
        )}
      </Sektion>

      {/* BAFA 1–4 + 6 · Stammdaten */}
      <Sektion
        titel="Stammdaten des Antragstellers (BAFA Abschnitte 1–4, 6)"
        hinweis={
          eingereicht
            ? `Eingereicht am ${fmtZeit(sd.updated_at)} – DSGVO-Einwilligung erteilt am ${fmtZeit(sd.dsgvo_einwilligung_at)}.`
            : 'Der Kunde hat die Journey noch nicht abgeschlossen.'
        }
      >
        {sd ? (
          <div>
            <Untertitel>1 · Unternehmen</Untertitel>
            <dl className="divide-y divide-olive-100">
              <Zeile label="Unternehmensname" wert={sd.unternehmensname} />
              <Zeile label="Adresse" wert={`${sd.strasse}, ${sd.plz} ${sd.ort}, ${sd.land}`} />
              <Zeile label="E-Mail (Unternehmen)" wert={sd.email} />
              <Zeile label="WZ-Code (2008)" wert={sd.wz_code} mono />
              <Zeile label="Unternehmensart (EU)" wert={UNTERNEHMENSART_LABELS[sd.unternehmensart]} />
              <Zeile label="Vorsteuerabzugsberechtigt" wert={jaNein(sd.vorsteuerabzug)} />
              <Zeile label="Antragsteller ist eine" wert={PERSONENART_LABELS[sd.personenart]} />
              {sd.personenart === 'natuerlich' ? (
                <>
                  <Zeile label="Geburtsdatum" wert={fmtDatum(sd.geburtsdatum)} />
                  <Zeile label="Steuer-ID (11-stellig)" wert={sd.steuer_id ?? fehlt} mono />
                </>
              ) : (
                <>
                  <Zeile label="Steuernummer" wert={sd.steuernummer ?? fehlt} mono />
                  <Zeile label="USt-IdNr." wert={sd.ust_id ?? fehlt} mono />
                </>
              )}
              {sd.register_company_id && (
                <Zeile
                  label="Handelsregister (OpenRegister)"
                  wert={`ID ${sd.register_company_id} · abgerufen ${fmtZeit(sd.register_abgerufen_am)}`}
                />
              )}
            </dl>

            <Untertitel>2 · Ansprechpartner</Untertitel>
            <dl className="divide-y divide-olive-100">
              <Zeile label="Rolle / Position" wert={sd.ap_rolle ?? fehlt} />
              <Zeile
                label="Name"
                wert={`${sd.ap_anrede ?? ''} ${sd.ap_vorname ?? ''} ${sd.ap_nachname ?? ''}`.trim() || fehlt}
              />
              <Zeile label="E-Mail (Ansprechpartner)" wert={sd.ap_email ?? fehlt} />
            </dl>

            <Untertitel>3–4 · Antrag & Bankverbindung</Untertitel>
            <dl className="divide-y divide-olive-100">
              <Zeile label="Gruppenzugehörigkeit" wert={GRUPPENZUGEHOERIGKEIT_LABELS[sd.gruppenzugehoerigkeit]} />
              <Zeile label="Wirtschaftlich tätig" wert={jaNein(sd.wirtschaftlich_taetig)} />
              <Zeile label="Kontoinhaber" wert={sd.kontoinhaber ?? fehlt} />
              <Zeile label="IBAN" wert={sd.iban ?? fehlt} mono />
              <Zeile label="Vorhaben noch nicht begonnen" wert={jaNein(sd.vorhaben_nicht_begonnen)} />
            </dl>

            <Untertitel>6 · Standort der Maßnahme</Untertitel>
            <dl className="divide-y divide-olive-100">
              {sd.standort_plz || sd.standort_ort || sd.standort_strasse ? (
                <Zeile
                  label="Abweichender Standort"
                  wert={`${sd.standort_strasse ?? ''}, ${sd.standort_plz ?? ''} ${sd.standort_ort ?? ''}`}
                />
              ) : (
                <Zeile label="Standort" wert="Wie Firmenanschrift" />
              )}
            </dl>
          </div>
        ) : (
          <LeerHinweis>
            Noch keine Stammdaten eingereicht
            {v.entwurf ? ' – Entwurfsdaten aus der laufenden Journey siehe unten.' : '.'}
          </LeerHinweis>
        )}
      </Sektion>

      {/* BAFA 5 · KMU-Einstufung */}
      <Sektion
        titel="KMU-Einstufung (BAFA Abschnitt 5 · EU 2003/361/EG)"
        hinweis="Die Bewertung des jüngsten abgeschlossenen Geschäftsjahres bestimmt die Förderquote (45 / 35 / 25 %)."
      >
        {v.kmuBewertungen.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-xl ring-1 ring-olive-200">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-olive-50 text-olive-500">
                    <th className="px-4 py-2.5 font-semibold">Geschäftsjahr</th>
                    <th className="px-4 py-2.5 font-semibold">Beschäftigte (JAE)</th>
                    <th className="px-4 py-2.5 font-semibold">Jahresumsatz</th>
                    <th className="px-4 py-2.5 font-semibold">Bilanzsumme</th>
                    <th className="px-4 py-2.5 font-semibold">Ergebnis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-olive-100">
                  {v.kmuBewertungen.map((k) => (
                    <tr key={k.id}>
                      <td className="px-4 py-2.5 font-medium text-mabe-900 tabular-nums">
                        {k.geschaeftsjahr}
                        {!k.abgeschlossen && <span className="ml-1 text-xs text-olive-500">(laufend)</span>}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{k.jae ?? fehlt}</td>
                      <td className="px-4 py-2.5 tabular-nums">{eur(k.umsatz)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{eur(k.bilanzsumme)}</td>
                      <td className="px-4 py-2.5">
                        {k.kategorie ? (
                          <span className="font-medium text-mabe-900">
                            {CATEGORY_LABELS[k.kategorie as Category] ?? k.kategorie} · {k.foerderquote_pct} %
                          </span>
                        ) : (
                          fehlt
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {berechnung && (
              <div className="rounded-xl bg-olive-50/60 p-4">
                <p className="text-xs font-semibold tracking-wide text-olive-600 uppercase">
                  Verbundrechnung (konsolidierte Werte, Geschäftsjahr {kmuAktuell?.geschaeftsjahr})
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[26rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="text-olive-500">
                        <th className="py-1.5 pr-4 font-semibold"></th>
                        <th className="px-3 py-1.5 font-semibold">JAE</th>
                        <th className="px-3 py-1.5 font-semibold">Umsatz</th>
                        <th className="px-3 py-1.5 font-semibold">Bilanzsumme</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-olive-100">
                      <tr>
                        <td className="py-1.5 pr-4 text-olive-600">Eigenes Unternehmen</td>
                        <td className="px-3 py-1.5 tabular-nums">{berechnung.own.employees.toLocaleString('de-DE')}</td>
                        <td className="px-3 py-1.5 tabular-nums">{eur(berechnung.own.turnover)}</td>
                        <td className="px-3 py-1.5 tabular-nums">{eur(berechnung.own.balanceSheet)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-4 text-olive-600">+ Partnerunternehmen (anteilig)</td>
                        <td className="px-3 py-1.5 tabular-nums">
                          {berechnung.partnerContribution.employees.toLocaleString('de-DE')}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums">{eur(berechnung.partnerContribution.turnover)}</td>
                        <td className="px-3 py-1.5 tabular-nums">{eur(berechnung.partnerContribution.balanceSheet)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-4 text-olive-600">+ Verbundene Unternehmen (100 %)</td>
                        <td className="px-3 py-1.5 tabular-nums">
                          {berechnung.linkedContribution.employees.toLocaleString('de-DE')}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums">{eur(berechnung.linkedContribution.turnover)}</td>
                        <td className="px-3 py-1.5 tabular-nums">{eur(berechnung.linkedContribution.balanceSheet)}</td>
                      </tr>
                      <tr className="font-semibold text-mabe-900">
                        <td className="py-1.5 pr-4">= Konsolidiert (maßgeblich)</td>
                        <td className="px-3 py-1.5 tabular-nums">
                          {berechnung.consolidated.employees.toLocaleString('de-DE')}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums">{eur(berechnung.consolidated.turnover)}</td>
                        <td className="px-3 py-1.5 tabular-nums">{eur(berechnung.consolidated.balanceSheet)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {berechnung.reasons.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs/5 text-olive-600">
                    {berechnung.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <LeerHinweis>Noch keine KMU-Bewertung eingereicht.</LeerHinweis>
        )}

        {v.beteiligungen.length > 0 ? (
          <div className="mt-4">
            <Untertitel>Partner- und verbundene Unternehmen (inkl. Beteiligungsketten)</Untertitel>
            <div className="overflow-x-auto rounded-xl ring-1 ring-olive-200">
              <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-olive-50 text-olive-500">
                    <th className="px-4 py-2.5 font-semibold">Unternehmen</th>
                    <th className="px-4 py-2.5 font-semibold">Richtung</th>
                    <th className="px-4 py-2.5 font-semibold">Anteil</th>
                    <th className="px-4 py-2.5 font-semibold">Zurechnung</th>
                    <th className="px-4 py-2.5 font-semibold">JAE</th>
                    <th className="px-4 py-2.5 font-semibold">Umsatz</th>
                    <th className="px-4 py-2.5 font-semibold">Bilanz</th>
                    <th className="px-4 py-2.5 font-semibold">Quelle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-olive-100">
                  {v.beteiligungen.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-2.5 font-medium text-mabe-900">
                        {b.name}
                        {b.stufe != null && b.stufe > 1 && (
                          <span
                            className="ml-1.5 rounded-full bg-mabe-100 px-1.5 py-0.5 text-[10px] font-semibold text-mabe-800"
                            title={b.pfad ?? undefined}
                          >
                            Kette · Stufe {b.stufe}
                          </span>
                        )}
                        {b.pfad && <p className="mt-0.5 text-xs font-normal text-olive-500">{b.pfad}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-olive-600">
                        {b.richtung === 'aufwaerts' ? 'an uns beteiligt' : 'unsere Beteiligung'}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{b.anteil_pct} %</td>
                      <td className="px-4 py-2.5 text-olive-600">
                        {b.anteil_pct > 50 ? '100 % (verbunden)' : `anteilig (Partner)`}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{b.jae ?? fehlt}</td>
                      <td className="px-4 py-2.5 tabular-nums">{eur(b.umsatz)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{eur(b.bilanzsumme)}</td>
                      <td className="px-4 py-2.5 text-xs text-olive-500">
                        {b.quelle === 'openregister' ? 'Handelsregister' : 'manuell'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          sd?.unternehmensart === 'eigenstaendig' && (
            <p className="mt-3 text-sm text-olive-600">
              Eigenständiges Unternehmen – keine Partner-/verbundenen Unternehmen angegeben.
            </p>
          )
        )}
      </Sektion>

      {/* BAFA · De-minimis */}
      <Sektion
        titel="De-minimis-Erklärung (VO (EU) 2023/2831)"
        hinweis="Höchstbetrag: 300.000 € im rollierenden 3-Jahres-Zeitraum."
      >
        {v.deminimis ? (
          <div className="flex flex-col gap-3">
            <dl className="divide-y divide-olive-100">
              <Zeile label="Fusion in den letzten 3 Jahren" wert={jaNein(v.deminimis.fusion_3j)} />
              <Zeile label="Unternehmensübernahme in den letzten 3 Jahren" wert={jaNein(v.deminimis.uebernahme_3j)} />
              <Zeile label="Aufspaltung in den letzten 3 Jahren" wert={jaNein(v.deminimis.aufspaltung_3j)} />
              <Zeile label="Beihilfen gesamt (3 Jahre)" wert={eur(v.deminimis.summe_eur)} />
              <Zeile
                label="Verbleibender De-minimis-Spielraum"
                wert={eur(Math.max(0, 300_000 - v.deminimis.summe_eur))}
              />
              <Zeile label="Bestätigt am (§ 264 StGB-Hinweis)" wert={fmtZeit(v.deminimis.bestaetigt_at)} />
            </dl>
            {v.beihilfen.length > 0 && (
              <div className="overflow-x-auto rounded-xl ring-1 ring-olive-200">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-olive-50 text-olive-500">
                      <th className="px-4 py-2.5 font-semibold">Beihilfegeber</th>
                      <th className="px-4 py-2.5 font-semibold">Aktenzeichen</th>
                      <th className="px-4 py-2.5 font-semibold">Bewilligt am</th>
                      <th className="px-4 py-2.5 font-semibold">Betrag</th>
                      <th className="px-4 py-2.5 font-semibold">Form</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-olive-100">
                    {v.beihilfen.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-2.5 font-medium text-mabe-900">{b.beihilfegeber}</td>
                        <td className="px-4 py-2.5 text-olive-600">{b.aktenzeichen ?? fehlt}</td>
                        <td className="px-4 py-2.5 tabular-nums">{fmtDatum(b.bewilligt_am)}</td>
                        <td className="px-4 py-2.5 tabular-nums">{eur(b.betrag)}</td>
                        <td className="px-4 py-2.5 text-olive-600">{BEIHILFE_FORM_LABELS[b.form]}</td>
                        <td className="px-4 py-2.5 text-olive-600">{BEIHILFE_STATUS_LABELS[b.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <LeerHinweis>Noch keine De-minimis-Erklärung eingereicht.</LeerHinweis>
        )}
      </Sektion>

      {/* BAFA 8 · Vollmacht */}
      <Sektion titel="Vollmacht & Beantragungsweg (BAFA Abschnitt 8)">
        {v.vollmacht ? (
          <dl className="divide-y divide-olive-100">
            <Zeile label="Beantragungsweg" wert={BEANTRAGUNGSWEG_LABELS[v.vollmacht.beantragungsweg]} />
            {v.vollmacht.beantragungsweg === 'eskalator' && (
              <>
                <Zeile label="Vollmacht unterzeichnet von" wert={v.vollmacht.unterzeichnet_von ?? fehlt} />
                <Zeile label="Unterzeichnet am" wert={fmtZeit(v.vollmacht.unterzeichnet_at)} />
                <Zeile label="Nachweis (IP)" wert={v.vollmacht.unterschrift_ip ?? fehlt} mono />
              </>
            )}
          </dl>
        ) : (
          <LeerHinweis>Noch kein Beantragungsweg gewählt.</LeerHinweis>
        )}
      </Sektion>

      {/* Dokumente */}
      <Sektion titel="Dokumente & Ablage" hinweis="Alle Dateien des Vorgangs (Vercel Blob).">
        {v.dokumente.length > 0 ? (
          <ul className="divide-y divide-olive-100">
            {v.dokumente.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-mabe-900">{DOKUMENT_TYP_LABELS[d.typ] ?? d.typ}</p>
                  <p className="text-xs text-olive-500">{fmtZeit(d.created_at)}</p>
                </div>
                <a
                  href={d.storage_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                >
                  Öffnen ↗
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <LeerHinweis>Noch keine Dokumente vorhanden.</LeerHinweis>
        )}
        <div className="mt-4">
          <SystemkonzeptAktionen
            angebotId={a.id}
            aktuelleUrl={v.dokumente.find((d) => d.typ === 'systemkonzept')?.storage_path ?? null}
            vorlagen={vorlagen}
          />
        </div>
      </Sektion>

      {/* Entwurfsdaten (Speichern & Fortsetzen) */}
      {v.entwurf && Object.keys(v.entwurf.schritte).length > 0 && (
        <details className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
          <summary className="cursor-pointer text-sm font-semibold text-mabe-900">
            Entwurfsdaten der Journey
            <span className="ml-2 font-normal text-olive-500">
              (zuletzt gespeichert: {fmtZeit(v.entwurf.updated_at)} · Schritt „
              {SCHRITTE.find((s) => s.id === v.entwurf?.aktueller_schritt)?.titel ?? v.entwurf.aktueller_schritt}“)
            </span>
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {Object.entries(v.entwurf.schritte).map(([schrittId, daten]) => (
              <details key={schrittId} className="rounded-xl border border-olive-200 bg-olive-50/40 px-4 py-2.5">
                <summary className="cursor-pointer text-xs font-semibold text-olive-600">
                  {SCHRITTE.find((s) => s.id === schrittId)?.titel ?? schrittId}
                </summary>
                <dl className="mt-1 divide-y divide-olive-100">
                  {Object.entries(daten).map(([feld, wert]) => (
                    <EntwurfWert key={feld} feld={feld} wert={wert} />
                  ))}
                </dl>
              </details>
            ))}
          </div>
        </details>
      )}

      {/* Übergaben + Audit */}
      {(v.uebergaben.length > 0 || v.audit.length > 0) && (
        <details className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
          <summary className="cursor-pointer text-sm font-semibold text-mabe-900">
            Technik-Protokoll (Webhook-Übergaben & Verlauf)
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            {v.uebergaben.length > 0 && (
              <div>
                <Untertitel>Übergaben an Eskalator/n8n</Untertitel>
                <ul className="divide-y divide-olive-100">
                  {v.uebergaben.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-olive-600 tabular-nums">{fmtZeit(u.versucht_at)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          u.erfolg ? 'bg-teal-100 text-teal-800' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {u.erfolg ? 'übergeben' : 'fehlgeschlagen'}
                        {u.http_status ? ` · HTTP ${u.http_status}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {v.audit.length > 0 && (
              <div>
                <Untertitel>Verlauf (letzte {v.audit.length} Ereignisse)</Untertitel>
                <ul className="divide-y divide-olive-100">
                  {v.audit.map((e) => (
                    <li key={e.id} className="py-2 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-mabe-900">{e.aktion}</span>
                        <span className="text-xs text-olive-500 tabular-nums">{fmtZeit(e.created_at)}</span>
                      </div>
                      <p className="text-xs text-olive-500">
                        {e.actor}
                        {e.details ? ` · ${JSON.stringify(e.details)}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Aktionen */}
      <section className="rounded-2xl border border-olive-200 bg-white p-5 sm:p-6">
        <h3 className="mb-3 text-sm font-semibold text-mabe-900">Vorgangs-Aktionen</h3>
        <VorgangAktionen angebotId={a.id} status={a.status} />
      </section>
    </article>
  )
}
