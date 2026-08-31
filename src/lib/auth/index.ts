import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

/**
 * Better-Auth-Instanz (serverseitig). Datenbank = Supabase-Postgres via
 * node-postgres-Pool (DATABASE_URL, niemals NEXT_PUBLIC_).
 *
 * Rollenmodell: user.role ('admin' | 'vertrieb'), per additionalFields am
 * User-Objekt. Neue Nutzer werden ausschließlich serverseitig angelegt
 * (scripts/create-admin.mjs bzw. spaeteres Admin-UI) – oeffentliche
 * Registrierung ist im Handler deaktiviert.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase erzwingt TLS; CA-Pinning kann bei Bedarf nachgezogen werden.
    ssl: { rejectUnauthorized: false },
    max: 5,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'vertrieb',
        input: false, // Rolle kommt nie aus dem Client
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 8, // 8 h Arbeitstag-Session
    updateAge: 60 * 60,
  },
})

export type Session = typeof auth.$Infer.Session
