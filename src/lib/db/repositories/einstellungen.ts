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
