import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Serverseitiger Supabase-Client (Service-Role, bypassed RLS – unsere
 * Autorisierung erfolgt in den Guards/Repositories, RLS ist zusaetzliche
 * Tiefenverteidigung gegen Client-Zugriff).
 *
 * Niemals in Client-Komponenten importieren ('server-only' bricht den
 * Build ab, falls doch).
 */
import 'server-only'

let cached: SupabaseClient | null = null

export function supabaseServer(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE: NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.')
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
