import 'server-only'

import { baueAntragZusammenfassungHtml, type AntragZusammenfassung } from './antrag-zusammenfassung'
import { istTestAdresse } from './guard'
import { baueLeadBenachrichtigungHtml, type LeadPayload } from './lead-benachrichtigung'
import { absender, portalUrl, resendClient } from './resend'
import { button, esc, h1, infoBox, layout, p } from './templates'

/**
 * Notification-Funktionen entlang des Förderprozesses.
 *
 * Design-Prinzipien:
 * - Jede Funktion ist BEST EFFORT: Fehler werden geloggt, niemals geworfen –
 *   ein Mail-Ausfall darf weder Angebotserstellung noch Antrag blockieren.
 * - Rueckgabe ist ein VersandErgebnis { ok, grund? }: der Grund (fehlender
 *   API-Key, Resend-Fehler wie „Domain nicht verifiziert", blockierte
 *   Testadresse) ist sichtbar statt verschluckt – Aufrufer koennen ihn im
 *   Audit vermerken und dem Admin direkt anzeigen.
 * - Neue Benachrichtigungen = neue Funktion hier + Template in templates.ts.
 */

/** Ergebnis eines Versands – grund nur bei ok === false (lesbar, kurz). */
export interface VersandErgebnis {
  ok: boolean
  grund?: string
}

async function sendeMail(
  an: string | string[],
  betreff: string,
  html: string,
  anhaenge?: { filename: string; content: string }[], // content = base64
): Promise<VersandErgebnis> {
  // Sicherheitsnetz: Test-/Platzhalter-Adressen niemals wirklich versenden
  const empfaenger = (Array.isArray(an) ? an : [an]).filter((a) => !istTestAdresse(a))
  if (empfaenger.length === 0) {
    const grund = 'Nur Test-/Platzhalter-Adressen – Versand bewusst blockiert'
    console.warn(`[email] ${grund}: "${betreff}"`)
    return { ok: false, grund }
  }
  const client = resendClient()
  if (!client) {
    const grund = 'Kein Resend-API-Key gesetzt (Vercel-Umgebungsvariable RESEND_API_KEY)'
    console.warn(`[email] ${grund} – Versand übersprungen: "${betreff}" an ${empfaenger.join(', ')}`)
    return { ok: false, grund }
  }
  try {
    const { error } = await client.emails.send({
      from: absender(),
      to: empfaenger,
      subject: betreff,
      html,
      ...(anhaenge && anhaenge.length > 0 ? { attachments: anhaenge } : {}),
    })
    if (error) {
      // Typisch: „The <domain> domain is not verified" (DNS-Eintraege fehlen)
      const grund = `Resend: ${error.message ?? 'unbekannter Fehler'}`
      console.error(`[email] ${grund} bei "${betreff}" an ${empfaenger.join(', ')}`)
      return { ok: false, grund }
    }
    return { ok: true }
  } catch (e) {
    const grund = `Versandfehler: ${e instanceof Error ? e.message : String(e)}`
    console.error(`[email] ${grund} ("${betreff}" an ${empfaenger.join(', ')})`)
    return { ok: false, grund }
  }
}

/**
 * 0 · Test-Mail (Admin-Einstellungen): verifiziert Key, Absender und
 * Domain-Verifizierung end-to-end. Geht an den angemeldeten Admin selbst.
 */
export async function sendeTestMail(an: string): Promise<VersandErgebnis> {
  const html = layout(
    'Test-Mail',
    [
      h1('Der E-Mail-Versand funktioniert ✅'),
      p(
        `Diese Test-Mail wurde aus dem MABE Förderportal versendet. Absender: <strong>${esc(absender())}</strong>. ` +
          `Wenn Sie sie sehen, sind API-Key und Domain-Verifizierung korrekt eingerichtet.`,
      ),
    ].join(''),
  )
  return sendeMail(an, 'Test-Mail: MABE Förderportal (E-Mail-Versand)', html)
}

/** 1 · Einladung: Vertrieb hat ein Angebot angelegt -> Kunde erhaelt seinen Link. */
export async function sendeEinladung(daten: {
  an: string
  kundeFirma: string
  angebotNr: string
  journeyPfad: string // z. B. /v/<token>
  ansprechpartner?: string | null
  zuschussBisZu?: number | null
}): Promise<VersandErgebnis> {
  const link = portalUrl(daten.journeyPfad)
  const html = layout(
    `Ihr Förderprojekt ${daten.angebotNr}`,
    [
      h1('Ihr Förderprojekt ist vorbereitet'),
      p(`Guten Tag,`),
      p(
        `für <strong>${esc(daten.kundeFirma)}</strong> wurde das Förderprojekt <strong>${esc(daten.angebotNr)}</strong> ` +
          `im BAFA-Programm Modul 3 vorbereitet. Über Ihren persönlichen Link prüfen Sie Ihren KMU-Status, ` +
          `ergänzen die Antragsdaten und erteilen die Vollmacht – in etwa 10 Minuten.` +
          (daten.zuschussBisZu
            ? ` Möglich sind dabei bis zu <strong>${daten.zuschussBisZu.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</strong> Zuschuss.`
            : ''),
      ),
      p(`<a href="${link}" style="color:#0d9488;word-break:break-all;">${link}</a>`),
      button(link, 'Förderprojekt öffnen →'),
      infoBox(
        `Der Link ist <strong>90 Tage</strong> gültig und nur für Sie bestimmt. Sie können jederzeit ` +
          `zwischenspeichern und später fortsetzen – Ihre Eingaben bleiben erhalten.`,
      ),
      p(
        daten.ansprechpartner
          ? `Bei Fragen hilft Ihnen ${esc(daten.ansprechpartner)} von MABE gerne weiter.`
          : `Bei Fragen hilft Ihnen Ihr MABE-Ansprechpartner gerne weiter.`,
      ),
    ].join(''),
  )
  return sendeMail(daten.an, `Ihr Förderprojekt ${daten.angebotNr} – persönlicher Zugang`, html)
}

/** 2 · Eingangsbestätigung + vollständige Antrags-Zusammenfassung an den Kunden. */
export async function sendeEingangsbestaetigung(daten: {
  an: string
  zusammenfassung: AntragZusammenfassung
  /** Optionales Angebots-PDF als Anhang (content = base64). */
  angebotAnhang?: { filename: string; content: string } | null
}): Promise<VersandErgebnis> {
  const html = layout(
    `Ihre Antragsdaten ${daten.zusammenfassung.angebotNr}`,
    baueAntragZusammenfassungHtml(daten.zusammenfassung),
  )
  return sendeMail(
    daten.an,
    `Ihre Antragsdaten im Überblick – Förderprojekt ${daten.zusammenfassung.angebotNr}`,
    html,
    daten.angebotAnhang ? [daten.angebotAnhang] : undefined,
  )
}

/** 3 · Passwort zurücksetzen (wird von Better Auth aufgerufen). */
export async function sendePasswortReset(daten: { an: string; resetUrl: string }): Promise<VersandErgebnis> {
  const html = layout(
    'Passwort zurücksetzen',
    [
      h1('Passwort zurücksetzen'),
      p(
        `Sie haben das Zurücksetzen Ihres Passworts für das MABE Förderportal angefordert. ` +
          `Der folgende Link ist <strong>1 Stunde</strong> gültig:`,
      ),
      button(daten.resetUrl, 'Neues Passwort festlegen →'),
      infoBox(
        `Falls Sie das Zurücksetzen <strong>nicht</strong> angefordert haben, ignorieren Sie diese E-Mail – ` +
          `Ihr bisheriges Passwort bleibt gültig.`,
      ),
    ].join(''),
  )
  return sendeMail(daten.an, 'Ihr Passwort für das MABE Förderportal zurücksetzen', html)
}

/** 4 · Willkommen: Kunde hat ein Konto angelegt. */
export async function sendeWillkommen(daten: { an: string; name?: string }): Promise<VersandErgebnis> {
  const html = layout(
    'Willkommen im Förderportal',
    [
      h1('Willkommen im MABE Förderportal'),
      p(`${daten.name ? `Guten Tag ${esc(daten.name)},` : 'Guten Tag,'}`),
      p(
        `Ihr Konto wurde angelegt. Ab sofort sehen Sie dort jederzeit den <strong>Status Ihrer Fördervorgänge</strong> ` +
          `und Ihre eingereichten Angaben.`,
      ),
      button(portalUrl('/konto'), 'Zu meinem Konto →'),
    ].join(''),
  )
  return sendeMail(daten.an, 'Willkommen im MABE Förderportal', html)
}

/** 5 · Status-Update an den Kunden (z. B. nach Bearbeitung durch das Team). */
export async function sendeStatusUpdate(daten: {
  an: string
  kundeFirma: string
  angebotNr: string
  statusText: string
}): Promise<VersandErgebnis> {
  const html = layout(
    `Status-Update ${daten.angebotNr}`,
    [
      h1('Es gibt Neuigkeiten zu Ihrem Förderprojekt'),
      p(
        `Ihr Förderprojekt <strong>${esc(daten.angebotNr)}</strong> (${esc(daten.kundeFirma)}) hat einen neuen Status:`,
      ),
      infoBox(`<strong>${esc(daten.statusText)}</strong>`),
      button(portalUrl('/konto'), 'Status im Konto ansehen →'),
    ].join(''),
  )
  return sendeMail(daten.an, `Status-Update – Förderprojekt ${daten.angebotNr}`, html)
}

/** 6 · Benutzer-Einladung: Admin laedt ein Teammitglied (MABE/Eskalator) ein. */
export async function sendeBenutzerEinladung(daten: {
  an: string
  rolleLabel: string
  einladungPfad: string // z. B. /einladung/<token>
  eingeladenVon: string
}): Promise<VersandErgebnis> {
  const link = portalUrl(daten.einladungPfad)
  const html = layout(
    'Einladung zum MABE Förderportal',
    [
      h1('Sie wurden eingeladen'),
      p(`Guten Tag,`),
      p(
        `${esc(daten.eingeladenVon)} hat Sie als <strong>${esc(daten.rolleLabel)}</strong> zum MABE Förderportal ` +
          `eingeladen. Über den folgenden Link legen Sie Ihr Konto an (Name + Passwort):`,
      ),
      button(link, 'Konto anlegen →'),
      infoBox(
        `Der Link ist <strong>14 Tage</strong> gültig und nur einmal einlösbar. ` +
          `Falls Sie diese Einladung nicht erwartet haben, ignorieren Sie diese E-Mail.`,
      ),
    ].join(''),
  )
  return sendeMail(daten.an, 'Einladung zum MABE Förderportal', html)
}

/**
 * 7 · Lead-Benachrichtigung (intern): Landingpage-KMU-Check wurde mit
 * Kontaktdaten abgeschlossen. Enthaelt ALLE Angaben als kopierfähige
 * Tabellen (KMU-Ergebnis, Verflechtung, Verrechnung, Kontakt, Meta).
 * Empfaenger aus den Admin-Einstellungen (lead_email_empfaenger) mit
 * ENV-/Standard-Fallback. Best effort – blockiert den Lead nie.
 */
export async function sendeLeadBenachrichtigung(payload: LeadPayload): Promise<VersandErgebnis> {
  const { ermittleLeadEmpfaenger } = await import('@/lib/db/repositories/einstellungen')
  const { empfaenger } = await ermittleLeadEmpfaenger()
  if (empfaenger.length === 0) {
    console.warn('[email] Keine Lead-Empfänger konfiguriert – Versand übersprungen.')
    return { ok: false, grund: 'Keine Lead-Empfänger konfiguriert (Einstellungen)' }
  }
  const firma = payload.company?.name || 'Unbekanntes Unternehmen'
  const html = layout(
    `Neuer Lead: ${firma}`,
    [
      h1(`Neuer KMU-Check-Lead: ${esc(firma)}`),
      infoBox(
        `<strong>${esc(payload.result.categoryLabel)}</strong> · Förderquote ` +
          `<strong>${payload.result.fundingRatePct} %</strong> · Ansprechpartner: ` +
          `${esc([payload.lead.firstName, payload.lead.lastName].filter(Boolean).join(' '))} (${esc(payload.lead.email)})`,
      ),
      baueLeadBenachrichtigungHtml(payload),
    ].join(''),
  )
  // Eine Mail an alle Empfaenger (sichtbare Empfaengerliste, interner Verteiler)
  return sendeMail(empfaenger, `Neuer KMU-Check-Lead: ${firma} (${payload.result.categoryLabel})`, html)
}

/**
 * 8 · Unterschriebene Vollmacht (intern): Kunde hat die BAFA-Vollmacht
 * online unterzeichnet (Beantragung durch Eskalator AG). Das ausgefuellte
 * Original-Formular eew_vm_3 inkl. eingebetteter Signatur geht als PDF-Anhang
 * an die konfigurierten Empfaenger (lead_email_empfaenger im Admin-Menue).
 * Best effort – die Datei liegt zusaetzlich dauerhaft im Blob/Admin-Download.
 */
export async function sendeVollmachtAnAdmins(daten: {
  kundeFirma: string
  angebotNr: string
  unterzeichnetVon: string | null
  pdfBytes: Uint8Array
}): Promise<VersandErgebnis> {
  const { ermittleLeadEmpfaenger } = await import('@/lib/db/repositories/einstellungen')
  const { empfaenger } = await ermittleLeadEmpfaenger()
  if (empfaenger.length === 0) {
    console.warn('[email] Keine Lead-Empfänger konfiguriert – Vollmacht-Versand übersprungen.')
    return { ok: false, grund: 'Keine Lead-Empfänger konfiguriert (Einstellungen)' }
  }
  const html = layout(
    `Unterschriebene Vollmacht: ${daten.kundeFirma}`,
    [
      h1('Unterschriebene Vollmacht eingegangen'),
      p(
        `<strong>${esc(daten.kundeFirma)}</strong> hat die BAFA-Vollmacht zum Vorgang ` +
          `<strong>${esc(daten.angebotNr)}</strong> online unterzeichnet` +
          (daten.unterzeichnetVon ? ` (Unterzeichner/in: <strong>${esc(daten.unterzeichnetVon)}</strong>)` : '') +
          '.',
      ),
      infoBox(
        `Das <strong>ausgefüllte Original-Formular eew_vm_3</strong> mit eingebetteter Unterschrift liegt als ` +
          `PDF-Anhang bei. Es ist zusätzlich dauerhaft im Admin-Menü (Fallakte → Dokumente & Ablage) hinterlegt.`,
      ),
      p(`Der Vorgang kann jetzt zur Antragstellung an das Fördermittel-Team (Eskalator AG / WissensReich Academy UG) übergeben werden.`),
    ].join(''),
  )
  return sendeMail(
    empfaenger,
    `Unterschriebene Vollmacht: ${daten.kundeFirma} (${daten.angebotNr})`,
    html,
    [{ filename: `Vollmacht_${daten.angebotNr}.pdf`, content: Buffer.from(daten.pdfBytes).toString('base64') }],
  )
}
