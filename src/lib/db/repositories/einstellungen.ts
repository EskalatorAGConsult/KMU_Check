import 'server-only'

import { supabaseServer } from '@/lib/db/server'

/**
 * Einstellungen-Repository: Admin-konfigurierbare Schlüssel-Wert-Paare.
 * Aufrufer muessen requireAdmin() durchlaufen haben (lesende Server-Nutzung
 * wie die Webhook-Aufloesung darf ohne Guard erfolgen, da die Tabelle
 * ausschließlich serverseitig via Service-Role erreichbar ist).
 */

export async function holeEinstellung(schluessel: string): Promise<string | null> {
  const { data, error } = await supabaseServer()
    .from('einstellungen')
    .select('wert')
    .eq('schluessel', schluessel)
    .maybeSingle()
  if (error) throw new Error(`Einstellung konnte nicht geladen werden: ${error.message}`)
  return (data?.wert as string | undefined) ?? null
}

export async function setzeEinstellung(schluessel: string, wert: string, userId: string): Promise<void> {
  const { error } = await supabaseServer()
    .from('einstellungen')
    .upsert({ schluessel, wert, aktualisiert_von: userId }, { onConflict: 'schluessel' })
  if (error) throw new Error(`Einstellung konnte nicht gespeichert werden: ${error.message}`)
}

/** Wirksame Webhook-URL: DB-Wert mit ENV-Fallback (siehe lib/webhook.ts). */
export async function ermittleWebhookUrl(): Promise<{
  url: string | null
  quelle: 'datenbank' | 'umgebung' | 'keine'
}> {
  const { loeseWebhookAuf } = await import('@/lib/webhook')
  let dbWert: string | null = null
  try {
    dbWert = await holeEinstellung('webhook_url')
  } catch (e) {
    console.error('[einstellungen] webhook_url nicht lesbar, nutze ENV-Fallback:', e)
  }
  return loeseWebhookAuf(dbWert, process.env.WEBHOOK_URL)
}

/** Standard-Empfaenger fuer Lead-Benachrichtigungen (Landingpage-KMU-Check). */
export const LEAD_EMPFAENGER_STANDARD = 'robin@eskalator.ag'

/**
 * Wirksame Empfaenger-Liste fuer Lead-Benachrichtigungen.
 * Reihenfolge: DB-Einstellung > ENV (LEAD_EMAIL_AN) > Standard.
 * Mehrere Adressen per Komma oder Semikolon getrennt.
 */
export async function ermittleLeadEmpfaenger(): Promise<{
  empfaenger: string[]
  quelle: 'datenbank' | 'umgebung' | 'standard'
}> {
  const parse = (roh: string): string[] =>
    roh
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3 && s.includes('@'))

  let dbWert: string | null = null
  try {
    dbWert = await holeEinstellung('lead_email_empfaenger')
  } catch (e) {
    console.error('[einstellungen] lead_email_empfaenger nicht lesbar:', e)
  }
  if (dbWert && parse(dbWert).length > 0) return { empfaenger: parse(dbWert), quelle: 'datenbank' }
  if (process.env.LEAD_EMAIL_AN && parse(process.env.LEAD_EMAIL_AN).length > 0) {
    return { empfaenger: parse(process.env.LEAD_EMAIL_AN), quelle: 'umgebung' }
  }
  return { empfaenger: [LEAD_EMPFAENGER_STANDARD], quelle: 'standard' }
}
