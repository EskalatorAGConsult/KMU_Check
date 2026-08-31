import 'server-only'

import { absender, portalUrl, resendClient } from './resend'
import { button, esc, h1, infoBox, layout, p } from './templates'

/**
 * Notification-Funktionen entlang des Förderprozesses.
 *
 * Design-Prinzipien:
 * - Jede Funktion ist BEST EFFORT: Fehler werden geloggt, niemals geworfen –
 *   ein Mail-Ausfall darf weder Angebotserstellung noch Antrag blockieren.
 * - Rueckgabe true/false, damit Aufrufer den Versand im Audit vermerken koennen.
 * - Neue Benachrichtigungen = neue Funktion hier + Template in templates.ts.
 */

async function sendeMail(an: string, betreff: string, html: string): Promise<boolean> {
  const client = resendClient()
  if (!client) {
    console.warn(`[email] Kein RESEND_API_KEY gesetzt – Versand übersprungen: "${betreff}" an ${an}`)
    return false
  }
  try {
    const { error } = await client.emails.send({ from: absender(), to: an, subject: betreff, html })
    if (error) {
      console.error(`[email] Resend-Fehler bei "${betreff}" an ${an}:`, error)
      return false
    }
    return true
  } catch (e) {
    console.error(`[email] Versand fehlgeschlagen ("${betreff}" an ${an}):`, e)
    return false
  }
}

/** 1 · Einladung: Vertrieb hat ein Angebot angelegt -> Kunde erhaelt seinen Link. */
export async function sendeEinladung(daten: {
  an: string
  kundeFirma: string
  angebotNr: string
  journeyPfad: string // z. B. /v/<token>
  ansprechpartner?: string | null
  zuschussBisZu?: number | null
}): Promise<boolean> {
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

/** 2 · Eingangsbestätigung: Kunde hat die Journey vollständig abgeschlossen. */
export async function sendeEingangsbestaetigung(daten: {
  an: string
  kundeFirma: string
  angebotNr: string
  beantragungsweg: 'eskalator' | 'selbst'
  kategorieLabel: string
  foerderquotePct: number
}): Promise<boolean> {
  const html = layout(
    `Eingangsbestätigung ${daten.angebotNr}`,
    [
      h1('Vielen Dank – Ihre Angaben sind vollständig'),
      p(
        `wir haben alle Angaben zum Förderprojekt <strong>${esc(daten.angebotNr)}</strong> für ` +
          `<strong>${esc(daten.kundeFirma)}</strong> erhalten.`,
      ),
      infoBox(
        `<strong>Ihre Auswertung:</strong> ${esc(daten.kategorieLabel)} · Förderquote <strong>${daten.foerderquotePct} %</strong><br>` +
          (daten.beantragungsweg === 'eskalator'
            ? `<strong>Beantragung:</strong> durch den Fördermittel-Concierge der Eskalator AG (operative Abwicklung: WissensReich Academy GmbH, Mülheim an der Ruhr). Sie müssen nichts weiter tun – wir melden uns.`
            : `<strong>Beantragung:</strong> durch Ihr Unternehmen selbst. Ihr Antrags-Dossier wird vorbereitet und Ihnen zugesendet.`),
      ),
      p(`<strong>Wie geht es weiter?</strong>`),
      p(
        `1. Prüfung Ihrer Angaben auf Vollständigkeit<br>` +
          `2. Antragstellung beim BAFA<br>` +
          `3. Bewilligung – danach kann die Maßnahme starten`,
      ),
      p(`Bei Rückfragen genügt die Angabe der Angebotsnummer <strong>${esc(daten.angebotNr)}</strong>.`),
    ].join(''),
  )
  return sendeMail(daten.an, `Eingangsbestätigung – Förderprojekt ${daten.angebotNr}`, html)
}

/** 3 · Passwort zurücksetzen (wird von Better Auth aufgerufen). */
export async function sendePasswortReset(daten: { an: string; resetUrl: string }): Promise<boolean> {
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
export async function sendeWillkommen(daten: { an: string; name?: string }): Promise<boolean> {
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
}): Promise<boolean> {
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
}): Promise<boolean> {
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
