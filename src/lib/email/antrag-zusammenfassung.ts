import { formatEUR, formatNumber, type KmuResult } from '@/lib/kmu'

import { esc, h1, infoBox, p } from './templates'

/**
 * Builder fuer die Antrags-Zusammenfassungs-E-Mail an den Kunden (nach
 * Journey-Abschluss). Rein stringbasiert, framework-frei – voll testbar.
 * Gestaltung in MABE-CI: Sektionen mit Kopfzeile, Label/Wert-Tabellen,
 * prominente Förderquote. Mail-Client-sicher (Tabellen + inline Styles).
 */

export interface AntragZusammenfassung {
  kundeFirma: string
  angebotNr: string
  // Unternehmen
  strasse: string
  plz: string
  ort: string
  email: string
  wzCode: string
  ustId?: string | null
  // Ansprechpartner
  apName: string
  apRolle?: string | null
  apEmail: string
  // KMU (jüngstes Geschäftsjahr, verbundgerechnet)
  kmu: KmuResult
  geschaeftsjahr: number
  kmuSchaetzung: boolean
  /** Zweites BAFA-Abfragejahr (Entwicklung) – null, falls nicht erhoben. */
  kmuVorjahr?: { geschaeftsjahr: number; ergebnis: KmuResult } | null
  // Vorhaben (aus dem Angebot)
  technologien: string[]
  investSumme: number | null
  sensorenGesamt?: number | null
  projektende?: string | null
  // Abschluss
  beantragungsweg: 'eskalator' | 'selbst'
  deminimisSumme: number
}

const NAVY = '#0b2239'
const OLIVE = '#5b6570'

function sektion(titel: string, inhalt: string): string {
  return `<div style="margin:22px 0 0;">
    <p style="color:${OLIVE};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;border-bottom:1px solid #e5e9ee;padding-bottom:6px;">${esc(titel)}</p>
    ${inhalt}
  </div>`
}

function tabelle(zeilen: [string, string | null | undefined][]): string {
  const sichtbar = zeilen.filter((z): z is [string, string] => !!z[1])
  if (sichtbar.length === 0) return ''
  return `<table role="presentation" style="width:100%;border-collapse:collapse;">${sichtbar
    .map(
      ([label, wert]) => `<tr>
        <td style="color:${OLIVE};font-size:13px;padding:5px 12px 5px 0;vertical-align:top;width:42%;">${esc(label)}</td>
        <td style="color:${NAVY};font-size:13px;font-weight:600;padding:5px 0;vertical-align:top;">${esc(wert)}</td>
      </tr>`,
    )
    .join('')}</table>`
}

function quoteHero(kmu: KmuResult, zuschuss: number | null): string {
  return `<div style="background:${NAVY};border-radius:14px;padding:22px 24px;margin:18px 0;color:#ffffff;">
    <table role="presentation" style="width:100%;border-collapse:collapse;"><tr>
      <td style="vertical-align:middle;">
        <span style="font-size:42px;font-weight:700;color:#5eead4;line-height:1;">${kmu.fundingRatePct}&nbsp;%</span>
        <span style="display:block;font-size:13px;color:#cbd5e1;margin-top:4px;">Förderquote · ${esc(kmu.categoryLabel)}</span>
      </td>
      ${
        zuschuss != null
          ? `<td style="vertical-align:middle;text-align:right;">
              <span style="font-size:20px;font-weight:700;color:#5eead4;">bis zu ${esc(formatEUR(zuschuss))}</span>
              <span style="display:block;font-size:12px;color:#cbd5e1;margin-top:4px;">voraussichtlicher Zuschuss</span>
            </td>`
          : ''
      }
    </tr></table>
  </div>`
}

/** Baut den Inhalt der Zusammenfassungs-Mail (innerhalb des Basis-Layouts). */
export function baueAntragZusammenfassungHtml(z: AntragZusammenfassung): string {
  const zuschuss = z.investSumme != null && z.investSumme > 0 ? (z.investSumme * z.kmu.fundingRatePct) / 100 : null
  const c = z.kmu.consolidated

  return [
    h1('Ihre Antragsdaten im Überblick'),
    p(
      `vielen Dank – wir haben alle Angaben zum Förderprojekt <strong>${esc(z.angebotNr)}</strong> für ` +
        `<strong>${esc(z.kundeFirma)}</strong> erhalten. Hier Ihre vollständige Zusammenfassung – ` +
        `<strong>Ihr Angebot liegt dieser E-Mail als PDF-Anhang bei.</strong>`,
    ),
    quoteHero(z.kmu, zuschuss),

    sektion(
      `KMU-Einstufung (Geschäftsjahr ${z.geschaeftsjahr})`,
      tabelle([
        ['Einstufung', z.kmu.categoryLabel],
        ['Förderquote', `${z.kmu.fundingRatePct} %`],
        ['Beschäftigte im Verbund', `${formatNumber(c.employees, 1)} JAE`],
        ['Umsatz im Verbund', formatEUR(c.turnover)],
        ['Bilanzsumme im Verbund', formatEUR(c.balanceSheet)],
        ['Datengrundlage', z.kmuSchaetzung ? 'Schätzung nach Treu und Glauben' : 'Abgeschlossenes Geschäftsjahr'],
        ...(z.kmuVorjahr
          ? ([['Entwicklung', `Geschäftsjahr ${z.kmuVorjahr.geschaeftsjahr}: ${z.kmuVorjahr.ergebnis.categoryLabel}`]] as [
              string,
              string,
            ][])
          : []),
      ]) +
        `<p style="color:#33404d;font-size:13px;line-height:1.6;margin:10px 0 0;">
          Im Verbund hat Ihr Unternehmen die Größe von <strong>${formatNumber(c.employees, 1)} Beschäftigten (JAE)</strong> –
          ${
            c.employees !== z.kmu.own.employees ||
            c.turnover !== z.kmu.own.turnover ||
            c.balanceSheet !== z.kmu.own.balanceSheet
              ? 'Ihre Partner- und verbundenen Unternehmen sind darin bereits anteilig eingerechnet.'
              : 'es zählen allein Ihre eigenen Kennzahlen.'
          }
          Damit gelten Sie als <strong>${esc(z.kmu.categoryLabel)}</strong>.
        </p>`,
    ),

    sektion(
      'Ihr Unternehmen (Antragsteller)',
      tabelle([
        ['Unternehmen', z.kundeFirma],
        ['Adresse', `${z.strasse}, ${z.plz} ${z.ort}`],
        ['E-Mail', z.email],
        ['WZ-Code', z.wzCode],
        ['USt-IdNr.', z.ustId ?? undefined],
      ]),
    ),

    sektion(
      'Ansprechpartner',
      tabelle([
        ['Name', z.apName],
        ['Rolle', z.apRolle ?? undefined],
        ['E-Mail', z.apEmail],
      ]),
    ),

    sektion(
      'Ihr Fördervorhaben',
      tabelle([
        ['Technologien', z.technologien.join(' · ')],
        ['Investition (lt. Angebot)', z.investSumme != null && z.investSumme > 0 ? formatEUR(z.investSumme) : null],
        ['Messpunkte / Sensoren', z.sensorenGesamt != null ? formatNumber(z.sensorenGesamt) : null],
        ['Projektende', z.projektende ? new Date(z.projektende).toLocaleDateString('de-DE') : null],
      ]),
    ),

    sektion(
      'Beantragung',
      infoBox(
        z.beantragungsweg === 'eskalator'
          ? `<strong>Durch den Fördermittel-Concierge der WissensReich Academy</strong> (kostenlos für Sie). ` +
            `Ihre unterschriebene Vollmacht liegt vor – die WissensReich Academy UG (haftungsbeschränkt), Köln, reicht ` +
            `Ihren Antrag beim BAFA ein und übernimmt die komplette Kommunikation mit der Bewilligungsstelle: ` +
            `Rückfragen, Nachreiche von Unterlagen, Bescheid. <strong>Sie müssen nichts weiter tun.</strong>`
          : `<strong>Durch Ihr Unternehmen selbst.</strong> Sie erhalten Ihr vollständiges Antrags-Dossier – Hinweis: Für das FZD-Portal ist ein ELSTER-Organisationszertifikat erforderlich.`,
      ) +
        tabelle([['Angegebene De-minimis-Beihilfen (3 Jahre)', formatEUR(z.deminimisSumme)]]),
    ),

    p(`<strong>Wie geht es weiter?</strong>`),
    p(
      `1. Wir prüfen Ihre Angaben auf Vollständigkeit<br>` +
        `2. Antragstellung beim BAFA (durch die WissensReich Academy)<br>` +
        `3. Bewilligung – danach kann die Maßnahme starten; bei Rückfragen der Behörde antwortet der Concierge für Sie`,
    ),
    p(
      `Bewahren Sie diese E-Mail als Nachweis auf. Bei Rückfragen genügt die Angabe der Angebotsnummer ` +
        `<strong>${esc(z.angebotNr)}</strong>.`,
    ),
    `<p style="color:${OLIVE};font-size:12px;line-height:1.6;margin:18px 0 0;border-top:1px solid #e5e9ee;padding-top:14px;">
      Unverbindliche Orientierung nach EU-Empfehlung 2003/361/EG – die verbindliche Einstufung und Bewilligung prüft das BAFA.
    </p>`,
  ].join('')
}
