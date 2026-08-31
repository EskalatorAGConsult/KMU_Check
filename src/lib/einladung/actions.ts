'use server'

import { z } from 'zod'

import { auth } from '@/lib/auth'
import {
  existiertBenutzer,
  markiereEinladungVerwendet,
  setzeBenutzerRolle,
  validiereEinladungsToken,
} from '@/lib/db/repositories/benutzer'
import { audit } from '@/lib/db/repositories/journey'

/**
 * Oeffentliche Server Action zum Annehmen einer Benutzer-Einladung.
 * Autorisierung = gueltiger Einladungs-Token (Link ist das Geheimnis,
 * nur als SHA-256-Hash in der DB, 14 Tage gueltig, einmalig einloesbar).
 */

const schema = z.object({
  token: z.string().min(10),
  name: z.string().trim().min(2, 'Bitte Ihren vollständigen Namen angeben.').max(120),
  password: z.string().min(12, 'Das Passwort muss mindestens 12 Zeichen haben.'),
})

export type EinladungErgebnis = { ok: true } | { ok: false; fehler: string }

export async function nehmeEinladungAn(eingabe: {
  token: string
  name: string
  password: string
}): Promise<EinladungErgebnis> {
  const res = schema.safeParse(eingabe)
  if (!res.success) return { ok: false, fehler: res.error.issues[0]?.message ?? 'Eingaben unvollständig.' }

  const einladung = await validiereEinladungsToken(res.data.token)
  if (!einladung) {
    return { ok: false, fehler: 'Dieser Einladungslink ist ungültig, abgelaufen oder wurde bereits verwendet.' }
  }
  if (await existiertBenutzer(einladung.email)) {
    return { ok: false, fehler: 'Für diese E-Mail existiert bereits ein Konto – bitte direkt anmelden.' }
  }

  try {
    // Konto ueber Better-Auth anlegen (Passwort-Hashing etc.), Rolle serverseitig setzen
    const ergebnis = await auth.api.signUpEmail({
      body: { email: einladung.email, name: res.data.name, password: res.data.password },
    })
    const userId = ergebnis?.user?.id
    if (!userId) throw new Error('Konto konnte nicht angelegt werden.')

    await setzeBenutzerRolle(userId, einladung.rolle)
    await markiereEinladungVerwendet(einladung.id)
    await audit(null, 'system', 'einladung_angenommen', {
      email: einladung.email,
      rolle: einladung.rolle,
      userId,
    })
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      fehler: e instanceof Error ? e.message : 'Konto konnte nicht angelegt werden.',
    }
  }
}
