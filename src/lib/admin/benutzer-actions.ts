'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/guards'
import {
  ADMIN_ROLLEN,
  erstelleEinladung,
  existiertBenutzer,
  setzeBenutzerRolle,
  widerrufeEinladung,
  type AdminRolle,
} from '@/lib/db/repositories/benutzer'
import { audit } from '@/lib/db/repositories/journey'
import { sendeBenutzerEinladung } from '@/lib/email/notify'
import { ROLLEN_LABEL, SETZBARE_ROLLEN } from '@/lib/admin/rollen'

export type BenutzerActionErgebnis = { ok: true; hinweis: string; link?: string } | { ok: false; fehler: string }

/** Laedt ein Teammitglied per Einladungslink ein (Rolle admin/eskalator/vertrieb). */
export async function ladeBenutzerEin(email: string, rolle: string): Promise<BenutzerActionErgebnis> {
  const session = await requireAdmin()
  const bereinigt = email.trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bereinigt)) {
    return { ok: false, fehler: 'Bitte eine gültige E-Mail-Adresse eingeben.' }
  }
  if (!ADMIN_ROLLEN.includes(rolle as AdminRolle)) {
    return { ok: false, fehler: 'Ungültige Rolle. Kunden registrieren sich selbst über das Portal.' }
  }
  if (await existiertBenutzer(bereinigt)) {
    return { ok: false, fehler: 'Für diese E-Mail existiert bereits ein Konto.' }
  }

  try {
    const klartext = await erstelleEinladung(bereinigt, rolle as AdminRolle, session.user.id)
    const pfad = `/einladung/${klartext}`
    const versand = await sendeBenutzerEinladung({
      an: bereinigt,
      rolleLabel: ROLLEN_LABEL[rolle] ?? rolle,
      einladungPfad: pfad,
      eingeladenVon: session.user.email,
    })
    await audit(null, `admin:${session.user.id}`, 'benutzer_eingeladen', {
      email: bereinigt,
      rolle,
      gesendet: versand.ok,
      grund: versand.grund ?? null,
    })
    revalidatePath('/admin/benutzer')
    return {
      ok: true,
      hinweis: versand.ok
        ? `Einladung an ${bereinigt} gesendet.`
        : `Einladung angelegt, aber E-Mail-Versand fehlgeschlagen (${versand.grund ?? 'unbekannt'}) – bitte den Link manuell weitergeben.`,
      link: pfad,
    }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Einladung fehlgeschlagen.' }
  }
}

/** Widerruft eine offene Einladung (Link verliert sofort seine Gültigkeit). */
export async function widerrufeEinladungAction(einladungId: string): Promise<BenutzerActionErgebnis> {
  const session = await requireAdmin()
  try {
    await widerrufeEinladung(einladungId)
    await audit(null, `admin:${session.user.id}`, 'einladung_widerrufen', { einladungId })
    revalidatePath('/admin/benutzer')
    return { ok: true, hinweis: 'Einladung wurde widerrufen.' }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Widerruf fehlgeschlagen.' }
  }
}

/** Aendert die Rolle eines Kontos (nie die eigene – Schutz vor Selbst-Aussperrung). */
export async function aendereRolleAction(userId: string, rolle: string): Promise<BenutzerActionErgebnis> {
  const session = await requireAdmin()
  if (userId === session.user.id) {
    return { ok: false, fehler: 'Die eigene Rolle kann nicht geändert werden (Schutz vor Selbst-Aussperrung).' }
  }
  if (!(SETZBARE_ROLLEN as readonly string[]).includes(rolle)) return { ok: false, fehler: 'Ungültige Rolle.' }

  try {
    await setzeBenutzerRolle(userId, rolle)
    await audit(null, `admin:${session.user.id}`, 'rolle_geaendert', { userId, rolle })
    revalidatePath('/admin/benutzer')
    return { ok: true, hinweis: `Rolle wurde auf „${ROLLEN_LABEL[rolle] ?? rolle}“ geändert.` }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Rollenänderung fehlgeschlagen.' }
  }
}
