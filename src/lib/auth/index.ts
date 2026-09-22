import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

import { pgSsl } from '@/lib/db/ssl'
import { sendePasswortReset, sendeWillkommen } from '@/lib/email/notify'

/**
 * Better-Auth-Instanz (serverseitig). Datenbank = Supabase-Postgres via
 * node-postgres-Pool (DATABASE_URL, niemals NEXT_PUBLIC_).
 *
 * Rollenmodell: user.role ('admin' | 'vertrieb' | 'kunde').
 * - Vertriebskonten (admin/vertrieb) werden serverseitig angelegt
 *   (scripts/create-admin.mjs), Rolle kommt nie aus dem Client.
 * - Kunden duerfen sich oeffentlich registrieren (Default-Rolle 'kunde'),
 *   um den Status ihrer Vorgaenge einzusehen.
 *
 * E-Mails (Passwort-Reset, Willkommen) laufen ueber Resend – best effort,
 * ein Mail-Ausfall blockiert den Auth-Flow nicht.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    // verify-full mit gepinnter Supabase-Root-CA (certs/supabase-prod-ca.crt)
    ssl: pgSsl(),
    max: 5,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    sendResetPassword: async ({ user, url }) => {
      await sendePasswortReset({ an: user.email, resetUrl: url })
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Willkommens-Mail nur an Kundenkonten (Vertrieb bekommt seine
          // Zugangsdaten auf anderem Weg).
          if ((user as { role?: string }).role === 'kunde') {
            await sendeWillkommen({ an: user.email, name: user.name })
          }
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'kunde',
        input: false, // Rolle kommt nie aus dem Client
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 8, // 8 h Session
    updateAge: 60 * 60,
  },
})

export type Session = typeof auth.$Infer.Session
