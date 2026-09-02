import { toNextJsHandler } from 'better-auth/next-js'

import { auth } from '@/lib/auth'

/**
 * Auth-Handler. Oeffentliche Registrierung ist fuer KUNDEN freigegeben
 * (Default-Rolle 'kunde', siehe lib/auth). Vertriebsrollen koennen darueber
 * nicht erlangt werden (role ist input:false und wird serverseitig gesetzt).
 *
 * Hinweis: Die Handler werden als benannte Funktionen exportiert (nicht per
 * Destrukturierung) – Next 16/Turbopack erkennt destrukturierte
 * Route-Exports nicht zuverlaessig („ComponentMod.handler is not a function").
 */
const betterAuthHandler = toNextJsHandler(auth)

export async function GET(request: Request): Promise<Response> {
  return betterAuthHandler.GET(request)
}

export async function POST(request: Request): Promise<Response> {
  return betterAuthHandler.POST(request)
}
