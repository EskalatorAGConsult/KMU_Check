'use server'

import { headers } from 'next/headers'

import { supabaseServer } from '@/lib/db/server'
import { ermittleWebhookUrl } from '@/lib/db/repositories/einstellungen'
import {
  audit,
  holeFortschritt,
  setzeAngebotStatus,
  speichereFortschritt,
  validiereToken,
} from '@/lib/db/repositories/journey'
import { SCHRITTE, schrittNach } from '@/lib/journey/schritte'
import { schemaFuerSchritt, type DeminimisSchrittDaten, type KmuSchrittDaten, type VollmachtSchrittDaten } from '@/lib/journey/schemas'
import { evaluateKmu } from '@/lib/kmu'
import { sendeEingangsbestaetigung } from '@/lib/email/notify'
import { generiereSystemkonzept } from '@/lib/systemkonzept/generate'
import { ladeDokumentHoch } from '@/lib/storage/blob'
import { fuelleVollmachtAus } from '@/lib/vollmacht/fuelle-vollmacht'

/**
 * Server Actions der Kunden-Journey. Jede Action validiert den Token
 * selbst (Autorisierung), Drafts werden unvalidiert als JSONB gespeichert,
 * die finale Validierung erfolgt vollstaendig in schliesseJourneyAb().
 */

export type ActionErgebnis =
  | { ok: true }
  | { ok: false; fehler: string; schrittFehler?: Record<string, string> }

/** Draft-Speicherung eines Schritts (Speichern & spaeter fortsetzen). */
export async function speichereSchritt(
  klartextToken: string,
  schrittId: string,
  daten: Record<string, unknown>,
): Promise<ActionErgebnis> {
  const kontext = await validiereToken(klartextToken)
  if (!kontext) return { ok: false, fehler: 'Der Link ist ungültig oder abgelaufen.' }
  if (!schrittNach(schrittId)) return { ok: false, fehler: 'Unbekannter Schritt.' }
  if (kontext.angebot.status === 'eingereicht' || kontext.angebot.status === 'abgeschlossen') {
    return { ok: false, fehler: 'Dieser Vorgang wurde bereits eingereicht.' }
  }

  try {
    await speichereFortschritt(kontext.angebot.id, schrittId, daten, schrittId)
    if (kontext.angebot.status === 'angelegt' || kontext.angebot.status === 'eingeladen') {
      await setzeAngebotStatus(kontext.angebot.id, 'in_bearbeitung')
    }
    await audit(kontext.angebot.id, `kunde:${kontext.token.id}`, 'schritt_gespeichert', { schrittId })
    return { ok: true }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.' }
  }
}

function normalisiereIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase()
}

function jaNeinZuBoolean(v: unknown): boolean {
  return v === 'ja' || v === true
}

/** Finale Validierung aller Schritte + Ueberfuehrung in die fachlichen Tabellen. */
export async function schliesseJourneyAb(
  klartextToken: string,
  alleDaten: Record<string, Record<string, unknown>>,
): Promise<ActionErgebnis> {
  const kontext = await validiereToken(klartextToken)
  if (!kontext) return { ok: false, fehler: 'Der Link ist ungültig oder abgelaufen.' }
  const { angebot, token } = kontext
  if (angebot.status === 'eingereicht' || angebot.status === 'abgeschlossen') {
    return { ok: false, fehler: 'Dieser Vorgang wurde bereits eingereicht.' }
  }

  // 1 · Alle Schritte vollstaendig validieren
  const validiert: Record<string, unknown> = {}
  const schrittFehler: Record<string, string> = {}
  for (const schritt of SCHRITTE) {
    if (schritt.komponente === 'uebersicht') continue
    const roh = alleDaten[schritt.id] ?? {}
    const res = schemaFuerSchritt(schritt).safeParse(roh)
    if (!res.success) {
      schrittFehler[schritt.id] = res.error.issues[0]?.message ?? 'Angaben unvollständig oder fehlerhaft.'
    } else {
      validiert[schritt.id] = res.data
    }
  }
  if (Object.keys(schrittFehler).length > 0) {
    return { ok: false, fehler: 'Bitte prüfen Sie die markierten Schritte.', schrittFehler }
  }

  const unternehmen = validiert['unternehmen'] as Record<string, unknown>
  const ansprechpartner = validiert['ansprechpartner'] as Record<string, unknown>
  const antrag = validiert['antrag'] as Record<string, unknown>
  const kmu = validiert['kmu'] as KmuSchrittDaten
  // Datenkonsistenz: explizites „keine Beteiligungen" erzwingt leeren Verbund
  if (kmu.hat_beteiligungen === false) kmu.beteiligungen = []
  const deminimis = validiert['deminimis'] as DeminimisSchrittDaten
  const vollmacht = validiert['vollmacht'] as VollmachtSchrittDaten

  // 2 · KMU-Berechnung mit der bestehenden, geprueften Engine –
  // je Geschaeftsjahr; Foerderquote/Status aus dem juengsten Jahr.
  const holdings = kmu.beteiligungen.map((b, i) => ({
    id: `b${i}`,
    name: b.name,
    sharePct: b.anteil_pct,
    employees: b.jae ?? 0,
    turnover: b.umsatz ?? 0,
    balanceSheet: b.bilanzsumme ?? 0,
  }))
  const jahreSortiert = [...kmu.jahre].sort((a, b) => b.geschaeftsjahr - a.geschaeftsjahr)
  const bewertungen = jahreSortiert.map((j) => ({
    jahr: j,
    ergebnis: evaluateKmu({
      companyName: String(unternehmen.unternehmensname),
      fiscalYear: j.geschaeftsjahr,
      employees: j.jae,
      turnover: j.umsatz,
      balanceSheet: j.bilanzsumme,
      holdings,
    }),
  }))
  const kmuErgebnis = bewertungen[0].ergebnis

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = hdrs.get('user-agent') ?? null
  const db = supabaseServer()

  try {
    // 3 · Stammdaten (Abschnitte 1–5 des Zielformulars)
    const { error: e1 } = await db.from('stammdaten').upsert(
      {
        angebot_id: angebot.id,
        unternehmensname: String(unternehmen.unternehmensname),
        land: String(unternehmen.land ?? 'Deutschland'),
        plz: String(unternehmen.plz),
        ort: String(unternehmen.ort),
        strasse: String(unternehmen.strasse),
        email: String(unternehmen.email),
        wz_code: String(unternehmen.wz_code),
        unternehmensart: String(unternehmen.unternehmensart),
        vorsteuerabzug: jaNeinZuBoolean(unternehmen.vorsteuerabzug),
        personenart: String(unternehmen.personenart),
        geburtsdatum: (unternehmen.geburtsdatum as string) ?? null,
        steuer_id: (unternehmen.steuer_id as string) ?? null,
        steuernummer: (unternehmen.steuernummer as string) ?? null,
        ust_id: (unternehmen.ust_id as string) || null,
        ap_rolle: String(ansprechpartner.ap_rolle),
        ap_anrede: String(ansprechpartner.ap_anrede),
        ap_vorname: String(ansprechpartner.ap_vorname),
        ap_nachname: String(ansprechpartner.ap_nachname),
        ap_email: String(ansprechpartner.ap_email),
        gruppenzugehoerigkeit: String(antrag.gruppenzugehoerigkeit),
        wirtschaftlich_taetig: jaNeinZuBoolean(antrag.wirtschaftlich_taetig),
        kontoinhaber: String(antrag.kontoinhaber),
        iban: normalisiereIban(String(antrag.iban)),
        standort_plz: (antrag.standort_plz as string) || null,
        standort_ort: (antrag.standort_ort as string) || null,
        standort_strasse: (antrag.standort_strasse as string) || null,
        vorhaben_nicht_begonnen: vollmacht.vorhaben_nicht_begonnen,
        dsgvo_einwilligung_at: new Date().toISOString(),
      },
      { onConflict: 'angebot_id' },
    )
    if (e1) throw new Error(`Stammdaten: ${e1.message}`)

    // 4 · Verbund (ersetzen, dann neu schreiben)
    await db.from('beteiligungen').delete().eq('angebot_id', angebot.id)
    if (kmu.beteiligungen.length > 0) {
      const { error: e2 } = await db.from('beteiligungen').insert(
        kmu.beteiligungen.map((b) => ({
          angebot_id: angebot.id,
          name: b.name,
          richtung: b.richtung,
          anteil_pct: b.anteil_pct,
          jae: b.jae ?? null,
          umsatz: b.umsatz ?? null,
          bilanzsumme: b.bilanzsumme ?? null,
          quelle: b.quelle,
        })),
      )
      if (e2) throw new Error(`Beteiligungen: ${e2.message}`)
    }

    // 5 · KMU-Bewertungen (Snapshot je Geschaeftsjahr inkl. vollstaendiger Berechnung)
    for (const { jahr, ergebnis } of bewertungen) {
      const { error: e3 } = await db.from('kmu_bewertungen').upsert(
        {
          angebot_id: angebot.id,
          geschaeftsjahr: jahr.geschaeftsjahr,
          abgeschlossen: jahr.abgeschlossen,
          jae: jahr.jae,
          umsatz: jahr.umsatz,
          bilanzsumme: jahr.bilanzsumme,
          kategorie: ergebnis.category,
          foerderquote_pct: ergebnis.fundingRatePct,
          berechnung: ergebnis,
        },
        { onConflict: 'angebot_id,geschaeftsjahr' },
      )
      if (e3) throw new Error(`KMU-Bewertung ${jahr.geschaeftsjahr}: ${e3.message}`)
    }

    // 6 · De-minimis
    await db.from('deminimis_beihilfen').delete().eq('angebot_id', angebot.id)
    if (deminimis.beihilfen.length > 0) {
      const { error: e4 } = await db.from('deminimis_beihilfen').insert(
        deminimis.beihilfen.map((b) => ({ angebot_id: angebot.id, ...b })),
      )
      if (e4) throw new Error(`De-minimis-Beihilfen: ${e4.message}`)
    }
    const summe = deminimis.beihilfen.reduce((s, b) => s + b.betrag, 0)
    const { error: e5 } = await db.from('deminimis_erklaerungen').upsert(
      {
        angebot_id: angebot.id,
        fusion_3j: deminimis.fusion_3j,
        uebernahme_3j: deminimis.uebernahme_3j,
        aufspaltung_3j: deminimis.aufspaltung_3j,
        summe_eur: summe,
        bestaetigt_at: new Date().toISOString(),
      },
      { onConflict: 'angebot_id' },
    )
    if (e5) throw new Error(`De-minimis-Erklärung: ${e5.message}`)

    // 7 · Vollmacht / Beantragungsweg
    const { error: e6 } = await db.from('vollmachten').upsert(
      {
        angebot_id: angebot.id,
        beantragungsweg: vollmacht.beantragungsweg,
        signatur_modus: vollmacht.beantragungsweg === 'eskalator' ? 'canvas' : null,
        unterzeichnet_at: vollmacht.beantragungsweg === 'eskalator' ? new Date().toISOString() : null,
        unterzeichnet_von: vollmacht.unterschrift_name ?? null,
        unterschrift_ip: ip,
        unterschrift_ua: ua,
      },
      { onConflict: 'angebot_id' },
    )
    if (e6) throw new Error(`Vollmacht: ${e6.message}`)

    // 8 · Status + Audit
    await setzeAngebotStatus(angebot.id, 'eingereicht')
    await audit(angebot.id, `kunde:${token.id}`, 'journey_abgeschlossen', {
      kategorie: kmuErgebnis.category,
      foerderquote_pct: kmuErgebnis.fundingRatePct,
      beantragungsweg: vollmacht.beantragungsweg,
      deminimis_summe: summe,
    })
  } catch (e) {
    await audit(angebot.id, 'system', 'abschluss_fehlgeschlagen', {
      fehler: e instanceof Error ? e.message : String(e),
    })
    return { ok: false, fehler: e instanceof Error ? e.message : 'Absenden fehlgeschlagen.' }
  }

  // 9 · Uebergabe an Eskalator/n8n (best effort, blockiert den Abschluss nicht)
  try {
    const { url: webhookUrl } = await ermittleWebhookUrl()
    const fortschritt = await holeFortschritt(angebot.id)
    const payload = {
      type: 'journey_abgeschlossen',
      angebot,
      validiert,
      kmu_ergebnis: kmuErgebnis,
      server: { received_at: new Date().toISOString(), ip, user_agent: ua },
    }
    let httpStatus: number | null = null
    let erfolg = false
    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      httpStatus = res.status
      erfolg = res.ok
    }
    await db.from('uebergaben').insert({
      angebot_id: angebot.id,
      payload: { ...payload, validiert: undefined, fortschritt_vorhanden: !!fortschritt },
      http_status: httpStatus,
      erfolg,
    })
  } catch (e) {
    console.error('[journey] Webhook-Uebergabe fehlgeschlagen:', e)
  }

  // 10 · Eingangsbestaetigung per E-Mail (best effort)
  const mailGesendet = await sendeEingangsbestaetigung({
    an: angebot.kunde_email,
    kundeFirma: angebot.kunde_firma,
    angebotNr: angebot.angebot_nr,
    beantragungsweg: vollmacht.beantragungsweg,
    kategorieLabel: kmuErgebnis.categoryLabel,
    foerderquotePct: kmuErgebnis.fundingRatePct,
  })
  await audit(angebot.id, 'system', 'bestaetigung_email', { gesendet: mailGesendet })

  // 11 · Systemkonzept generieren + ablegen (best effort, blockiert den Abschluss nicht)
  try {
    const pdfBytes = await generiereSystemkonzept(
      angebot,
      {
        unternehmensname: String(unternehmen.unternehmensname),
        strasse: String(unternehmen.strasse),
        plz: String(unternehmen.plz),
        ort: String(unternehmen.ort),
        land: String(unternehmen.land ?? 'Deutschland'),
        wz_code: String(unternehmen.wz_code),
        ap_rolle: String(ansprechpartner.ap_rolle),
        ap_vorname: String(ansprechpartner.ap_vorname),
        ap_nachname: String(ansprechpartner.ap_nachname),
        standort_strasse: (antrag.standort_strasse as string) || null,
        standort_plz: (antrag.standort_plz as string) || null,
        standort_ort: (antrag.standort_ort as string) || null,
      },
      { kategorie: kmuErgebnis.category, foerderquotePct: kmuErgebnis.fundingRatePct },
    )
    const url = await ladeDokumentHoch(
      `systemkonzept/${angebot.angebot_nr}.pdf`,
      pdfBytes,
    )
    if (url) {
      // storage_path ist unique – bei erneuter Einreichung alten Eintrag ersetzen
      await db.from('dokumente').delete().eq('angebot_id', angebot.id).eq('typ', 'systemkonzept')
      const { error: e7 } = await db.from('dokumente').insert({
        angebot_id: angebot.id,
        typ: 'systemkonzept',
        storage_path: url,
      })
      if (e7) throw new Error(`Dokumente: ${e7.message}`)
    }
    await audit(angebot.id, 'system', 'systemkonzept_generiert', { ok: !!url })
  } catch (e) {
    console.error('[journey] Systemkonzept-Generierung fehlgeschlagen:', e)
    await audit(angebot.id, 'system', 'systemkonzept_generiert', {
      ok: false,
      fehler: e instanceof Error ? e.message : String(e),
    })
  }

  // 12 · Offizielle BAFA-Vollmacht ausfuellen (nur bei Beantragung durch Eskalator, best effort)
  if (vollmacht.beantragungsweg === 'eskalator') {
    try {
      const vollmachtPdf = await fuelleVollmachtAus({
        unternehmensname: String(unternehmen.unternehmensname),
        strasse: String(unternehmen.strasse),
        plz: String(unternehmen.plz),
        ort: String(unternehmen.ort),
        vorgangsnummer: angebot.angebot_nr,
        unterschriftName: vollmacht.unterschrift_name ?? null,
      })
      const url = await ladeDokumentHoch(`vollmacht/${angebot.angebot_nr}.pdf`, vollmachtPdf)
      if (url) {
        await db.from('dokumente').delete().eq('angebot_id', angebot.id).eq('typ', 'vollmacht')
        const { error: e8 } = await db.from('dokumente').insert({
          angebot_id: angebot.id,
          typ: 'vollmacht',
          storage_path: url,
        })
        if (e8) throw new Error(`Dokumente: ${e8.message}`)
      }
      await audit(angebot.id, 'system', 'vollmacht_ausgefuellt', { ok: !!url })
    } catch (e) {
      console.error('[journey] Vollmacht-Ausfuellung fehlgeschlagen:', e)
      await audit(angebot.id, 'system', 'vollmacht_ausgefuellt', {
        ok: false,
        fehler: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { ok: true }
}
