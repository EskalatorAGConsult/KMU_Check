import { toNextJsHandler } from 'better-auth/next-js'

import { auth } from '@/lib/auth'

/**
 * Auth-Handler. Oeffentliche Registrierung ist fuer KUNDEN freigegeben
 * (Default-Rolle 'kunde', siehe lib/auth). Vertriebsrollen koennen darueber
 * nicht erlangt werden (role ist input:false und wird serverseitig gesetzt).
 */
export const { GET, POST } = toNextJsHandler(auth)
