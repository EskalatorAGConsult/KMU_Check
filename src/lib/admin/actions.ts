'use server'

import { z } from 'zod'

import { requireAdmin } from '@/lib/auth/guards'
import { erstelleAngebot, type NeuesAngebot } from '@/lib/db/repositories/angebote'
import { audit, erstelleJourneyToken, setzeAngebotStatus } from '@/lib/db/repositories/journey'
import { sendeEinladung } from '@/lib/email/notify'

const schema = z.object({
  kunde_firma: z.string().trim().min(2, 'Firmenname fehlt.').max(200),
  kunde_ansprechpartner: z.string().trim().optional(),
  kunde_email: z.email('Gültige E-Mail des Kunden fehlt.'),
  angebot_nr: z.string().trim().min(1, 'Angebotsnummer fehlt.'),
  angebot_datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Angebotsdatum fehlt.'),
  technologien: z
    .array(z.enum(['software', 'messtechnik', 'steuerung']))
    .min(1, 'Bitte mindestens eine Technologie wählen.'),
  software_variante: z.enum(['mabe_cloud', 'andere', 'offen']).optional(),
  invest_software: z.coerce.number().min(0).optional(),
  invest_messtechnik: z.coerce.number().min(0).optional(),
  invest_steuerung: z.coerce.number().min(0).optional(),
  sensoren_gesamt: z.coerce.number().int().min(0).optional(),
  sensoren_prozessbezug: z.coerce.number().int().min(0).optional(),
  projektende: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  notiz: z.string().trim().optional(),
})

export type AdminActionErgebnis =
  | { ok: true; angebotId: string; link: string }
  | { ok: false; fehler: string }

/** Legt ein Angebot an, erzeugt den Journey-Link und markiert es als eingeladen. */
export async function erstelleAngebotAction(eingabe: NeuesAngebot): Promise<AdminActionErgebnis> {
  const session = await requireAdmin()

  const res = schema.safeParse(eingabe)
  if (!res.success) {
    return { ok: false, fehler: res.error.issues[0]?.message ?? 'Eingaben unvollständig.' }
  }

  try {
    const angebotId = await erstelleAngebot(session.user.id, {
      ...res.data,
      projektende: res.data.projektende || undefined,
    })
    const klartext = await erstelleJourneyToken(angebotId)
    await setzeAngebotStatus(angebotId, 'eingeladen')
    await audit(angebotId, `admin:${session.user.id}`, 'angebot_angelegt', {
      angebot_nr: res.data.angebot_nr,
      kunde_firma: res.data.kunde_firma,
    })

    // Einladungs-E-Mail mit dem persoenlichen Link (best effort).
    const invest =
      (res.data.invest_software ?? 0) + (res.data.invest_messtechnik ?? 0) + (res.data.invest_steuerung ?? 0)
    const mailGesendet = await sendeEinladung({
      an: res.data.kunde_email,
      kundeFirma: res.data.kunde_firma,
      angebotNr: res.data.angebot_nr,
      journeyPfad: `/v/${klartext}`,
      ansprechpartner: res.data.kunde_ansprechpartner,
      zuschussBisZu: invest > 0 ? invest * 0.45 : null,
    })
    await audit(angebotId, 'system', 'einladung_email', { gesendet: mailGesendet })

    return { ok: true, angebotId, link: `/v/${klartext}` }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Anlegen fehlgeschlagen.' }
  }
}
