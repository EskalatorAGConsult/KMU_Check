import { formatEUR } from '@/lib/kmu'

/**
 * Baut die tabellarische Lead-Benachrichtigung (Landingpage-KMU-Check).
 * Reine Funktion ohne Framework-/Netzwerk-Abhaengigkeit – voll testbar.
 *
 * Ziel: ALLE Angaben des Leads als saubere HTML-Tabellen, damit das Team die
 * Werte direkt in das BAFA-Portal (Modul 3) uebernehmen („kopierfähig") kann.
 */

// ---------- Payload-Typen (Spiegel des Client-Payloads aus kmu-check.tsx) ----------

export interface LeadHolding {
  name: string
  direction: 'we_hold' | 'holds_us'
  sharePct: number
  relationship: 'linked' | 'partner'
  employees: number
  turnover: number
  balanceSheet: number
}

export interface LeadPayload {
  type?: string
  submitted_at?: string
  company: {
    name: string
    fiscalYear: number
    employees: number
    turnover: number
    balanceSheet: number
  }
  holdings: LeadHolding[]
  result: {
    category: string
    categoryLabel: string
    isKmu: boolean
    fundingRatePct: number
    consolidated: { employees: number; turnover: number; balanceSheet: number }
    own: { employees: number; turnover: number; balanceSheet: number }
    partnerContribution: { employees: number; turnover: number; balanceSheet: number }
    linkedContribution: { employees: number; turnover: number; balanceSheet: number }
  }
  lead: {
    salutation: string
    firstName: string
    lastName: string
    position: string
    email: string
    phone: string
    phoneCountry: string
    consent: boolean
  }
  tracking?: Record<string, unknown> | null
  server?: {
    received_at?: string
    ip?: string | null
    country?: string | null
    region?: string | null
    city?: string | null
    user_agent?: string | null
  }
}

// ---------- Mini-HTML-Bausteine (Mail-Client-kompatibel, inline Styles) ----------

const NAVY = '#0b2239'
const OLIVE = '#5b6570'
const LINE = '#e5e9ee'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function h2(text: string): string {
  return `<h2 style="color:${NAVY};font-size:15px;font-weight:700;margin:22px 0 8px;text-transform:uppercase;letter-spacing:0.5px;">${esc(text)}</h2>`
}

/** Label/Wert-Tabelle (kopierfreundlich). */
function tabelle(zeilen: [string, string][]): string {
  const body = zeilen
    .filter(([, wert]) => wert !== '')
    .map(
      ([label, wert], i) => `
      <tr>
        <td style="padding:7px 12px;border:1px solid ${LINE};background:${i % 2 ? '#ffffff' : '#f8fafc'};color:${OLIVE};font-size:13px;width:42%;vertical-align:top;">${esc(label)}</td>
        <td style="padding:7px 12px;border:1px solid ${LINE};background:${i % 2 ? '#ffffff' : '#f8fafc'};color:${NAVY};font-size:13px;font-weight:600;">${wert}</td>
      </tr>`,
    )
    .join('')
  return `<table style="border-collapse:collapse;width:100%;" role="presentation">${body}</table>`
}

const zahl = (v: number): string => (v ?? 0).toLocaleString('de-DE')
const eur = (v: number): string => formatEUR(v ?? 0)

const RICHTUNG_LABEL: Record<LeadHolding['direction'], string> = {
  we_hold: 'Beteiligung des Antragstellers (wir halten)',
  holds_us: 'Gesellschafter (hält an uns)',
}

const ART_LABEL: Record<LeadHolding['relationship'], string> = {
  linked: 'Verbunden (> 50 % – 100 % Verrechnung)',
  partner: 'Partner (25–50 % – anteilige Verrechnung)',
}

/** Komplettes HTML der Lead-Benachrichtigung (Inhalt ohne Basis-Layout). */
export function baueLeadBenachrichtigungHtml(p: LeadPayload): string {
  const r = p.result

  const verflechtung =
    p.holdings.length === 0
      ? `<p style="color:${OLIVE};font-size:13px;margin:6px 0;">Keine Beteiligungen/Gesellschafter angegeben.</p>`
      : `<table style="border-collapse:collapse;width:100%;" role="presentation">
          <tr>
            ${['Unternehmen', 'Richtung', 'Anteil', 'EU-Einstufung', 'JAE', 'Umsatz', 'Bilanzsumme']
              .map(
                (h) =>
                  `<th style="padding:7px 10px;border:1px solid ${LINE};background:${NAVY};color:#ffffff;font-size:12px;text-align:left;">${h}</th>`,
              )
              .join('')}
          </tr>
          ${p.holdings
            .map(
              (h, i) => `
            <tr>
              <td style="padding:7px 10px;border:1px solid ${LINE};background:${i % 2 ? '#ffffff' : '#f8fafc'};font-size:13px;font-weight:600;color:${NAVY};">${esc(h.name)}</td>
              <td style="padding:7px 10px;border:1px solid ${LINE};background:${i % 2 ? '#ffffff' : '#f8fafc'};font-size:12px;color:#33404d;">${RICHTUNG_LABEL[h.direction] ?? esc(h.direction)}</td>
              <td style="padding:7px 10px;border:1px solid ${LINE};background:${i % 2 ? '#ffffff' : '#f8fafc'};font-size:13px;color:${NAVY};">${zahl(h.sharePct)} %</td>
              <td style="padding:7px 10px;border:1px solid ${LINE};background:${i % 2 ? '#ffffff' : '#f8fafc'};font-size:12px;color:#33404d;">${ART_LABEL[h.relationship] ?? esc(h.relationship)}</td>
              <td style="padding:7px 10px;border:1px solid ${LINE};background:${i % 2 ? '#ffffff' : '#f8fafc'};font-size:13px;color:${NAVY};text-align:right;">${zahl(h.employees)}</td>
              <td style="padding:7px 10px;border:1px solid ${LINE};background:${i % 2 ? '#ffffff' : '#f8fafc'};font-size:13px;color:${NAVY};text-align:right;">${eur(h.turnover)}</td>
              <td style="padding:7px 10px;border:1px solid ${LINE};background:${i % 2 ? '#ffffff' : '#f8fafc'};font-size:13px;color:${NAVY};text-align:right;">${eur(h.balanceSheet)}</td>
            </tr>`,
            )
            .join('')}
        </table>`

  const tracking = (p.tracking ?? {}) as Record<string, unknown>
  const trackingZeilen: [string, string][] = (
    [
      ['gclid', tracking.gclid],
      ['fbclid', tracking.fbclid],
      ['utm_source', tracking.utm_source],
      ['utm_medium', tracking.utm_medium],
      ['utm_campaign', tracking.utm_campaign],
    ] as [string, unknown][]
  )
    .filter(([, v]) => typeof v === 'string' && v)
    .map(([k, v]) => [k, esc(String(v))] as [string, string])

  return [
    h2('KMU-Ergebnis'),
    tabelle([
      ['Einstufung (EU 2003/361/EG)', `<strong>${esc(r.categoryLabel)}</strong>`],
      ['KMU', r.isKmu ? 'Ja' : 'Nein'],
      ['Förderquote BAFA Modul 3', `${zahl(r.fundingRatePct)} %`],
      ['Geschäftsjahr', zahl(p.company.fiscalYear)],
    ]),
    h2('Unternehmen (Antragsteller)'),
    tabelle([
      ['Name', esc(p.company.name)],
      ['Beschäftigte (JAE)', zahl(p.company.employees)],
      ['Umsatz', eur(p.company.turnover)],
      ['Bilanzsumme', eur(p.company.balanceSheet)],
    ]),
    h2('KMU-Verflechtung (Beteiligungen & Gesellschafter)'),
    verflechtung,
    h2('Verrechnung der Kennzahlen'),
    tabelle([
      ['Eigene Werte', `${zahl(r.own.employees)} JAE · ${eur(r.own.turnover)} Umsatz · ${eur(r.own.balanceSheet)} Bilanz`],
      [
        '+ Partner (anteilig)',
        `${zahl(r.partnerContribution.employees)} JAE · ${eur(r.partnerContribution.turnover)} · ${eur(r.partnerContribution.balanceSheet)}`,
      ],
      [
        '+ Verbundene (100 %)',
        `${zahl(r.linkedContribution.employees)} JAE · ${eur(r.linkedContribution.turnover)} · ${eur(r.linkedContribution.balanceSheet)}`,
      ],
      [
        '= Konsolidiert (maßgeblich)',
        `<strong>${zahl(r.consolidated.employees)} JAE · ${eur(r.consolidated.turnover)} Umsatz · ${eur(r.consolidated.balanceSheet)} Bilanz</strong>`,
      ],
    ]),
    h2('Ansprechpartner (Lead)'),
    tabelle([
      ['Name', esc([p.lead.salutation, p.lead.firstName, p.lead.lastName].filter(Boolean).join(' '))],
      ['Position', esc(p.lead.position ?? '')],
      ['E-Mail', esc(p.lead.email)],
      ['Telefon', esc(p.lead.phone)],
      ['DSGVO-Einwilligung', p.lead.consent ? 'erteilt' : 'NICHT erteilt'],
    ]),
    h2('Meta'),
    tabelle([
      ['Eingegangen (Client)', esc(p.submitted_at ?? '')],
      ['Eingegangen (Server)', esc(p.server?.received_at ?? '')],
      ['IP', esc(p.server?.ip ?? '')],
      ['Geo', esc([p.server?.city, p.server?.region, p.server?.country].filter(Boolean).join(', '))],
      ['User-Agent', esc(p.server?.user_agent ?? '')],
      ...trackingZeilen,
    ]),
  ].join('')
}
