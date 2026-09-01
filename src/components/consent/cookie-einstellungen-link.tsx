'use client'

import { oeffneConsentEinstellungen } from '@/lib/consent'

/**
 * Footer-Einstieg „Cookie-Einstellungen" (DSGVO-Widerruf): oeffnet den
 * Consent-Dialog erneut, damit die Einwilligung jederzeit geaendert oder
 * widerrufen werden kann. Rendert als Listenpunkt wie die FooterLinks.
 */
export function CookieEinstellungenLink() {
  return (
    <li className="text-olive-700 dark:text-olive-400">
      <a
        href="#cookie-einstellungen"
        onClick={(e) => {
          e.preventDefault()
          oeffneConsentEinstellungen()
        }}
      >
        Cookie-Einstellungen
      </a>
    </li>
  )
}
