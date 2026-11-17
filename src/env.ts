import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

/**
 * Zentrale, schema-validierte ENV-Zugriffsstelle (T3 Env, env-core).
 *
 * Direkte process.env-Zugriffe sind ausserhalb dieser Datei verboten
 * (Single Source of Truth fuer Konfiguration).
 *
 * BEWUSSTE ENTSCHEIDUNG – alle Variablen sind optional:
 * Das Portal lebt vom Best-Effort-Muster (Resend ohne Key ueberspringen,
 * Blob ohne Token warnen, OpenRegister ohne Key manuell fortfuehren) und
 * `/api/health` muss auch ohne jede ENV diagnostizieren koennen. Daher
 * formatvalidiert, aber nicht pflicht: Fehlformat wirft beim Import
 * (Fail-Fast), fehlender Wert bleibt eine Laufzeit-Entscheidung des
 * Aufrufers. Fuer Builds/Tests ohne `.env.local`: SKIP_ENV_VALIDATION=1.
 *
 * LIVE-PROXY: createEnv validiert beim Import (Fail-Fast), die Eigenschafts-
 * Zugriffe lesen process.env aber live. Grund: die Testsuite arbeitet mit
 * vi.stubEnv (bestehende Konvention, z. B. gemini/angebot-analyse.test.ts) –
 * ein Import-Snapshot wuerde jede env-Stubbing-Suite brechen. In Produktion
 * aendert sich process.env nicht mehr nach dem Start, das Verhalten ist
 * identisch; `''` gilt wie `emptyStringAsUndefined` als nicht gesetzt.
 *
 * WICHTIG: Nur serverseitig importieren ('server-only'-Module, Route
 * Handlers, Server Components). Client-Komponenten benoetigen keine ENV
 * (alle NEXT_PUBLIC_*-Werte werden serverseitig konsumiert).
 */

const schema = createEnv({
  server: {
    /** Supabase Session-Pooler (Vercel) bzw. Direct-Host (lokal, IPv6!). */
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL muss eine Postgres-Connection-URL sein.')
      .optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.url('NEXT_PUBLIC_SUPABASE_URL muss eine gültige URL sein.').optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20, 'Publishable-Key wirkt zu kurz.').optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'Service-Role-Key wirkt zu kurz.').optional(),
    BETTER_AUTH_SECRET: z.string().min(16, 'BETTER_AUTH_SECRET sollte mindestens 16 Zeichen haben.').optional(),
    BETTER_AUTH_URL: z.url('BETTER_AUTH_URL muss eine gültige URL sein.').optional(),
    NEXT_PUBLIC_APP_URL: z.url('NEXT_PUBLIC_APP_URL muss eine gültige URL sein.').optional(),
    RESEND_API_KEY: z.string().min(10, 'RESEND_API_KEY wirkt zu kurz (beginnt mit re_).').optional(),
    EMAIL_FROM: z
      .string()
      .min(3, 'EMAIL_FROM erwartet z. B. „Name <mail@domain.de>“.')
      .refine((v) => v.includes('@'), 'EMAIL_FROM muss eine E-Mail-Adresse enthalten.')
      .optional(),
    /** Vercel Blob: Standardname ODER store-praefixter Name (Store „MABE"). */
    BLOB_READ_WRITE_TOKEN: z.string().min(10).optional(),
    MABE_READ_WRITE_TOKEN: z.string().min(10).optional(),
    BLOB_ACCESS: z.enum(['public', 'private']).optional(),
    OPENREGISTER_API_KEY: z.string().min(10).optional(),
    GEMINI_API_KEY: z.string().min(10).optional(),
    /** https (http nur localhost, wie lib/webhook.ts). */
    WEBHOOK_URL: z
      .string()
      .refine((v) => {
        try {
          const u = new URL(v)
          return u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))
        } catch {
          return false
        }
      }, 'WEBHOOK_URL muss https sein (http nur localhost).')
      .optional(),
    /** Komma-/Semikolon-Liste von Lead-Empfaengern (Fallback der DB-Einstellung). */
    LEAD_EMAIL_AN: z.string().optional(),
    /** Vercel Cron-Secret (Bearer) für /api/cron/fristen; fehlt = Cron fail-closed. */
    CRON_SECRET: z.string().min(8).optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})

export type Env = typeof schema

export const env: Env = new Proxy(schema, {
  get(ziel, schluessel) {
    const wert = process.env[schluessel as string]
    if (wert === undefined || wert === '') return undefined
    return wert
  },
})
