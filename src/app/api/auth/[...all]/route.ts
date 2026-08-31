import { toNextJsHandler } from 'better-auth/next-js'
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'

const handler = toNextJsHandler(auth)

export const GET = handler.GET

// Oeffentliche Registrierung ist deaktiviert: Vertriebskonten werden
// ausschließlich serverseitig angelegt (scripts/create-admin.mjs).
export async function POST(req: NextRequest) {
  if (req.nextUrl.pathname.includes('/sign-up')) {
    return NextResponse.json({ error: 'Registrierung ist deaktiviert.' }, { status: 403 })
  }
  return handler.POST(req)
}
