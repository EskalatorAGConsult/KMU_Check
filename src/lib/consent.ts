/**
 * DSGVO-Einwilligungsmanagement (Opt-in): Keine nicht-notwendige Verarbeitung
 * vor aktiver Einwilligung. Die Auswahl liegt in einem Erstanbieter-Cookie
 * (`mabe_consent`, 6 Monate) und wird versioniert – bei Katalog-Aenderung
 * (CONSENT_VERSION erhoehen) wird erneut gefragt.
 *
 * Kategorien (nach TDDDG § 25 / DSGVO Art. 6):
 * - notwendig: immer aktiv, nicht abwaehlbar (Consent-Cookie, Login-Session)
 * - statistik: Geraeteerkennung/Reichweitenmessung (Fingerprint-Besucher-ID)
 * - marketing: Werbe-Attribution (Klick-IDs, UTM, Meta-Cookies)
 *
 * Rein clientseitig (wie tracking.ts); alle Zugriffe sind SSR-sicher ge guardet.
 */

export type EinwilligungsKategorie = 'statistik' | 'marketing'

export interface Einwilligung {
  v: number
  statistik: boolean
  marketing: boolean
  /** ISO-Zeitpunkt der Entscheidung (Nachweis). */
  am: string
}

/** Bei inhaltlicher Aenderung des Katalogs erhoehen -> erneute Abfrage. */
export const CONSENT_VERSION = 1
export const CONSENT_COOKIE = 'mabe_consent'
const CONSENT_TAGE = 180

/** Wird nach jeder Einwilligungs-Aenderung auf window gefeuert. */
export const CONSENT_EVENT = 'mabe:consent-changed'
/** Oeffnet den Einstellungs-Dialog (z. B. Footer-Link „Cookie-Einstellungen"). */
export const CONSENT_OPEN_EVENT = 'mabe:consent-open'

export function leseEinwilligung(): Einwilligung | null {
  if (typeof document === 'undefined') return null
  const roh = document.cookie
    .split('; ')
    .find((c) => c.startsWith(CONSENT_COOKIE + '='))
    ?.split('=')
    .slice(1)
    .join('=')
  if (!roh) return null
  try {
    const e = JSON.parse(decodeURIComponent(roh)) as Einwilligung
    if (e.v !== CONSENT_VERSION || typeof e.statistik !== 'boolean' || typeof e.marketing !== 'boolean') return null
    return e
  } catch {
    return null
  }
}

export function speichereEinwilligung(auswahl: { statistik: boolean; marketing: boolean }): Einwilligung {
  const e: Einwilligung = { v: CONSENT_VERSION, ...auswahl, am: new Date().toISOString() }
  if (typeof document !== 'undefined') {
    const maxAge = CONSENT_TAGE * 24 * 60 * 60
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(e))}; Max-Age=${maxAge}; Path=/; SameSite=Lax`
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: e }))
  }
  return e
}

/** true nur bei ausdruecklicher Opt-in-Einwilligung fuer die Kategorie. */
export function hatEinwilligung(kategorie: EinwilligungsKategorie): boolean {
  return leseEinwilligung()?.[kategorie] === true
}

/** Fordert die erneute Anzeige des Consent-Dialogs an (Widerruf/Aenderung). */
export function oeffneConsentEinstellungen(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT))
}

// ---------- Cookie-/Speicher-Katalog (Anzeige im Einstellungs-Dialog) ----------

export interface CookieEintrag {
  name: string
  anbieter: string
  zweck: string
  dauer: string
}

export interface KategorieDef {
  id: EinwilligungsKategorie | 'notwendig'
  titel: string
  beschreibung: string
  eintraege: CookieEintrag[]
}

/**
 * Vollstaendige Offenlegung aller Cookies und vergleichbarer Speicher
 * (localStorage, Geraeteerkennung) dieses Portals – Stand der tatsaechlichen
 * Verwendung im Code (tracking.ts, auth, Consent). Bei neuen Trackern hier
 * nachtragen und CONSENT_VERSION erhoehen.
 */
export const COOKIE_KATALOG: KategorieDef[] = [
  {
    id: 'notwendig',
    titel: 'Unbedingt erforderlich',
    beschreibung:
      'Diese Speicher sind für den Betrieb der Seite technisch notwendig (Sicherheit, Einwilligungsstatus, ' +
      'Anmeldung). Sie können nicht deaktiviert werden.',
    eintraege: [
      {
        name: 'mabe_consent',
        anbieter: 'MABE (diese Website)',
        zweck: 'Speichert Ihre Einwilligungsauswahl (Nachweis der Einwilligung).',
        dauer: '6 Monate',
      },
      {
        name: 'better-auth.session_token',
        anbieter: 'MABE (diese Website)',
        zweck: 'Anmeldesitzung – nur im Admin- und Kundenkonto-Bereich, nicht auf der öffentlichen Seite.',
        dauer: 'Sitzung / 7 Tage',
      },
    ],
  },
  {
    id: 'statistik',
    titel: 'Statistik & Analyse',
    beschreibung:
      'Hilft uns, die Nutzung des KMU-Checks zu verstehen und Missbrauch (z. B. Mehrfach-Einreichungen) zu ' +
      'erkennen. Es werden keine Inhalte Ihrer Eingaben ausgewertet.',
    eintraege: [
      {
        name: 'Fingerprint-Besucher-ID (kein Cookie)',
        anbieter: 'FingerprintJS (läuft lokal in Ihrem Browser)',
        zweck:
          'Anonymisierter Geräte-Hash zur Missbrauchserkennung; wird ausschließlich beim Absenden des ' +
          'Kontaktformulars übertragen.',
        dauer: 'Wird bei jeder Seitenansicht neu berechnet',
      },
      {
        name: 'mabe_kmu_first_seen (lokaler Speicher)',
        anbieter: 'MABE (diese Website)',
        zweck: 'Merkt sich den Zeitpunkt Ihres ersten Besuchs (Besuchsdauer-Analyse).',
        dauer: 'Bis zur Löschung durch Sie',
      },
    ],
  },
  {
    id: 'marketing',
    titel: 'Marketing & Kampagnen-Messung',
    beschreibung:
      'Misst, über welche Anzeige oder Kampagne Sie zu uns gefunden haben (z. B. Google- oder LinkedIn-Anzeige), ' +
      'damit wir unsere Werbung steuern können. Es werden derzeit keine Drittanbieter-Skripte geladen.',
    eintraege: [
      {
        name: 'mabe_kmu_attr_* (lokaler Speicher)',
        anbieter: 'MABE (diese Website)',
        zweck: 'Speichert Klick-Kennungen und Kampagnen-Parameter (gclid, fbclid, UTM) Ihres ersten Besuchs.',
        dauer: 'Bis zur Löschung durch Sie',
      },
      {
        name: '_fbp, _fbc',
        anbieter: 'Meta Platforms (nur falls von Meta gesetzt)',
        zweck: 'Zuordnung von Anzeigenklicks (Facebook/Instagram). Werden nur gelesen, sofern vorhanden.',
        dauer: '90 Tage (durch Meta)',
      },
      {
        name: '_ga',
        anbieter: 'Google (nur falls von Google Analytics gesetzt)',
        zweck: 'Client-Kennung für Reichweitenmessung. Wird nur gelesen, sofern vorhanden.',
        dauer: '13 Monate (durch Google)',
      },
    ],
  },
]
