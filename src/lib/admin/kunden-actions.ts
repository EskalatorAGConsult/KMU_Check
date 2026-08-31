'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/guards'
import { holeAngebot } from '@/lib/db/repositories/angebote'
import { audit, erstelleJourneyToken, setzeAngebotStatus } from '@/lib/db/repositories/journey'
import { sendeEinladung } from '@/lib/email/notify'

export type KundeActionErgebnis = { ok: true; hinweis: string } | { ok: false; fehler: string }

/**
 * Erzeugt einen neuen Journey-Link und sendet die Einladung erneut
 * (z. B. wenn der Kunde die Mail verloren hat oder der Link abgelaufen ist).
 */
export async function erneutEinladen(angebotId: string): Promise<KundeActionErgebnis> {
  const session = await requireAdmin()
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }
  if (['eingereicht', 'abgeschlossen', 'widerrufen'].includes(angebot.status)) {
    return { ok: false, fehler: `Vorgang ist bereits ${angebot.status} – keine erneute Einladung möglich.` }
  }

  try {
    const klartext = await erstelleJourneyToken(angebotId)
    await setzeAngebotStatus(angebotId, 'eingeladen')
    const invest =
      (angebot.invest_software ?? 0) + (angebot.invest_messtechnik ?? 0) + (angebot.invest_steuerung ?? 0)
    const gesendet = await sendeEinladung({
      an: angebot.kunde_email,
      kundeFirma: angebot.kunde_firma,
      angebotNr: angebot.angebot_nr,
      journeyPfad: `/v/${klartext}`,
      ansprechpartner: angebot.kunde_ansprechpartner ?? undefined,
      zuschussBisZu: invest > 0 ? invest * 0.45 : null,
    })
    await audit(angebotId, `admin:${session.user.id}`, 'einladung_erneut', { gesendet })
    revalidatePath('/admin/kunden')
    return {
      ok: true,
      hinweis: gesendet
        ? 'Einladung erneut an den Kunden gesendet.'
        : `Neuer Link erstellt, aber E-Mail-Versand fehlgeschlagen. Link: /v/${klartext}`,
    }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Erneutes Einladen fehlgeschlagen.' }
  }
}

/** Setzt einen Vorgang auf „widerrufen“ (Journey-Links verlieren damit ihre Gültigkeit). */
export async function widerrufeVorgang(angebotId: string): Promise<KundeActionErgebnis> {
  const session = await requireAdmin()
  const angebot = await holeAngebot(angebotId)
  if (!angebot) return { ok: false, fehler: 'Vorgang nicht gefunden.' }
  if (angebot.status === 'widerrufen') return { ok: false, fehler: 'Vorgang ist bereits widerrufen.' }

  try {
    await setzeAngebotStatus(angebotId, 'widerrufen')
    await audit(angebotId, `admin:${session.user.id}`, 'vorgang_widerrufen', {
      vorheriger_status: angebot.status,
    })
    revalidatePath('/admin/kunden')
    revalidatePath('/admin')
    return { ok: true, hinweis: 'Vorgang wurde widerrufen. Bestehende Kunden-Links sind damit ungültig.' }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Widerruf fehlgeschlagen.' }
  }
}
