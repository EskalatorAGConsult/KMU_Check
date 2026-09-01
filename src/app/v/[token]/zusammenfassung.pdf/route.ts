import { NextResponse } from 'next/server'

import { protokolliereZugriff, validiereToken } from '@/lib/db/repositories/journey'
import { holeVorgang } from '@/lib/db/repositories/kunden'
import { generiereDossier, type DossierDaten } from '@/lib/dossier/generate'
import { loggeFehler } from '@/lib/fehler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /v/[token]/zusammenfassung.pdf – die eigene Antrags-Zusammenfassung als
 * PDF (Dossier) direkt aus der Journey heraus. Der persoenliche Link (Token)
 * IST die Zugriffsberechtigung: wer den Link hat, sieht dieselben Daten auch
 * im Wizard – keine zusaetzliche Anmeldung noetig, kein Datenabfluss an Dritte.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const kontext = await validiereToken(token)
  if (!kontext) {
    return NextResponse.json({ ok: false, fehler: 'Der Link ist ungültig oder abgelaufen.' }, { status: 404 })
  }

  // Zugriffsprotokoll (Migration 20): Auch der PDF-Download ist ein Aufruf
  // des persoenlichen Links – das Dossier enthaelt die sensibelsten Daten
  // (IBAN, Kontaktdaten), daher mit IP/Geraet festhalten, best effort.
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip')
    await protokolliereZugriff(kontext.angebot.id, kontext.token.id, ip ?? null, req.headers.get('user-agent'))
  } catch (e) {
    loggeFehler('journey', e, { route: 'zusammenfassung_pdf', schritt: 'zugriffsprotokoll' })
  }

  // DB-Fehler (throw) und „noch nicht eingereicht" (null) sauber trennen:
  // Ersteres ist transient -> 500 mit Retry-Hinweis, letzteres -> 404.
  let v: Awaited<ReturnType<typeof holeVorgang>>
  try {
    v = await holeVorgang(kontext.angebot.id)
  } catch (e) {
    loggeFehler('journey', e, { route: 'zusammenfassung_pdf', schritt: 'laden' })
    return NextResponse.json(
      { ok: false, fehler: 'Die Zusammenfassung konnte nicht geladen werden. Bitte erneut versuchen – Ihre Daten sind gespeichert.' },
      { status: 500 },
    )
  }
  if (!v || !v.stammdaten) {
    return NextResponse.json(
      { ok: false, fehler: 'Noch keine eingereichten Daten vorhanden – die Zusammenfassung entsteht nach dem Absenden.' },
      { status: 404 },
    )
  }

  const kmu = v.kmuBewertungen[0] ?? null
  const daten: DossierDaten = {
    angebot: v.angebot,
    stammdaten: v.stammdaten as unknown as Record<string, unknown>,
    beteiligungen: v.beteiligungen.map((b) => ({
      name: b.name,
      richtung: b.richtung,
      anteil_pct: b.anteil_pct,
      jae: b.jae,
      umsatz: b.umsatz,
      bilanzsumme: b.bilanzsumme,
    })),
    kmu: kmu
      ? {
          kategorie: kmu.kategorie ?? '',
          foerderquote_pct: kmu.foerderquote_pct ?? 0,
          geschaeftsjahr: kmu.geschaeftsjahr,
          jae: kmu.jae ?? 0,
          umsatz: kmu.umsatz ?? 0,
          bilanzsumme: kmu.bilanzsumme ?? 0,
        }
      : null,
    deminimis: v.deminimis,
    beihilfen: v.beihilfen.map((b) => ({
      beihilfegeber: b.beihilfegeber,
      aktenzeichen: b.aktenzeichen,
      bewilligt_am: b.bewilligt_am,
      betrag: b.betrag,
      form: b.form,
      status: b.status,
    })),
    vollmacht: v.vollmacht
      ? {
          beantragungsweg: v.vollmacht.beantragungsweg,
          unterzeichnet_von: v.vollmacht.unterzeichnet_von,
          unterzeichnet_at: v.vollmacht.unterzeichnet_at,
        }
      : null,
  }

  let pdf: Uint8Array
  try {
    pdf = await generiereDossier(daten)
  } catch (e) {
    loggeFehler('journey', e, { route: 'zusammenfassung_pdf', schritt: 'rendern' })
    return NextResponse.json(
      { ok: false, fehler: 'Die Zusammenfassung konnte nicht erstellt werden. Bitte erneut versuchen.' },
      { status: 500 },
    )
  }
  const dateiname = `antrags-zusammenfassung-${v.angebot.angebot_nr.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${dateiname}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
