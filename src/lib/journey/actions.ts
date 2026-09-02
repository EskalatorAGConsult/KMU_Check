'use server'

import { headers } from 'next/headers'

import { supabaseServer } from '@/lib/db/server'
import { list } from '@vercel/blob'
import { validiereUploadDatei } from '@/lib/admin/datei-upload'
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
import { holdingsFuerJahr, jahrKennzahl, jahreAufbauen } from '@/lib/journey/verbund-jahre'
import { evaluateKmu } from '@/lib/kmu'
import { sendeEingangsbestaetigung, sendeVollmachtAnAdmins } from '@/lib/email/notify'
import { loggeFehler } from '@/lib/fehler'
import { TECHNOLOGIE_LABELS } from '@/lib/labels'
import { generiereSystemkonzept } from '@/lib/systemkonzept/generate'
import { blobToken, ladeDokumentBuffer, ladeDokumentHoch, type BlobInhalt } from '@/lib/storage/blob'
import { normalisiereIban, normalisiereSteuerId } from '@/lib/validierung'
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

/**
 * Haendisch unterschriebene Vollmacht hochladen (Alternative zur Online-
 * Signatur, signatur_modus = 'upload'). Token-autorisiert; die Datei wird
 * validiert (Magic-Bytes: PDF/PNG/JPG, max. 15 MB) und im privaten Blob
 * archiviert. Der Client speichert den zurueckgegebenen Pfad als
 * vollmacht_upload_pfad im Journey-Entwurf.
 */
export async function ladeVollmachtUploadHoch(
  klartextToken: string,
  formData: FormData,
): Promise<{ ok: true; pfad: string } | { ok: false; fehler: string }> {
  const kontext = await validiereToken(klartextToken)
  if (!kontext) return { ok: false, fehler: 'Der Link ist ungültig oder abgelaufen.' }
  const { angebot, token } = kontext
  if (angebot.status === 'eingereicht' || angebot.status === 'abgeschlossen') {
    return { ok: false, fehler: 'Dieser Vorgang wurde bereits eingereicht.' }
  }

  const datei = await validiereUploadDatei(formData)
  if ('fehler' in datei) return { ok: false, fehler: datei.fehler }

  // Deckel gegen Blob-Missbrauch: jeder Upload legt einen neuen Blob an
  // (Ueberschreiben ist technisch nicht vorgesehen) – mehr als 10 Uploads
  // pro Vorgang sind kein Kundenverhalten mehr.
  const blobTok = blobToken()
  if (blobTok) {
    const { blobs } = await list({
      prefix: `vollmacht-upload/${angebot.angebot_nr}`,
      token: blobTok,
      limit: 100,
    })
    if (blobs.length >= 10) {
      return { ok: false, fehler: 'Zu viele Upload-Versuche – bitte dem MABE-Ansprechpartner melden.' }
    }
  }

  try {
    const endung = datei.contentType === 'application/pdf' ? 'pdf' : datei.contentType === 'image/png' ? 'png' : 'jpg'
    const url = await ladeDokumentHoch(`vollmacht-upload/${angebot.angebot_nr}.${endung}`, datei.bytes, datei.contentType)
    if (!url) return { ok: false, fehler: 'Storage nicht konfiguriert – bitte dem MABE-Ansprechpartner melden.' }
    await audit(angebot.id, `kunde:${token.id}`, 'vollmacht_upload', { datei: datei.name })
    return { ok: true, pfad: url }
  } catch (e) {
    loggeFehler('journey', e, { route: 'vollmacht_upload', angebotNr: angebot.angebot_nr })
    return { ok: false, fehler: 'Der Upload ist fehlgeschlagen. Bitte erneut versuchen.' }
  }
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
  // Verbund-Kennzahlen sind JAHRESBEZOGEN (BAFA fragt 2025 und 2024 ab):
  // holdingsFuerJahr() greift je Jahr auf die passenden Werte zu – Drafts aus
  // der Zeit vor der Jahres-Erfassung (ohne jahre) fallen auf die Skalarwerte
  // zurueck (verbund-jahre.ts).
  const jahreSortiert = [...kmu.jahre].sort((a, b) => b.geschaeftsjahr - a.geschaeftsjahr)
  const bewertungen = jahreSortiert.map((j) => ({
    jahr: j,
    ergebnis: evaluateKmu({
      companyName: String(unternehmen.unternehmensname),
      fiscalYear: j.geschaeftsjahr,
      employees: j.jae,
      turnover: j.umsatz,
      balanceSheet: j.bilanzsumme,
      holdings: holdingsFuerJahr(kmu.beteiligungen, j.geschaeftsjahr),
    }),
  }))
  const kmuErgebnis = bewertungen[0].ergebnis

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = hdrs.get('user-agent') ?? null
  const db = supabaseServer()

  // Gezeichnete Signatur: Dekodierung + Blob-Archiv ausserhalb des try,
  // damit die Bytes spaeter auch der PDF-Generierung (Schritt 12) zur
  // Verfuegung stehen. Nur im Canvas-Modus; im Upload-Modus ist das
  // hochgeladene Dokument selbst die signierte Vollmacht.
  const uploadPfad = vollmacht.vollmacht_upload_pfad ?? null
  // Trust-Boundary: Der Pfad stammt aus dem Client-Payload und wird NICHT
  // blind geglaubt – sonst ließe sich die Signatur-Pflicht mit einer
  // Phantom- oder fremden Blob-Referenz umgehen. Er muss aus der Upload-
  // Action DIESES Vorgangs stammen (Pfad-Präfix mit der eigenen
  // Angebotsnummer) und real existieren. Prüfung VOR allen DB-Writes.
  let uploadInhalt: BlobInhalt | null = null
  if (vollmacht.beantragungsweg === 'eskalator' && uploadPfad) {
    let pfadSegment: string | null = null
    try {
      pfadSegment = new URL(uploadPfad).pathname
    } catch {
      pfadSegment = null
    }
    const ungueltig = (grund: string) => ({
      ok: false as const,
      fehler: 'Bitte prüfen Sie den Schritt „Vollmacht & Beantragung“.',
      schrittFehler: { vollmacht: grund },
    })
    if (!pfadSegment?.startsWith(`/vollmacht-upload/${angebot.angebot_nr}`)) {
      return ungueltig('Die Upload-Referenz ist ungültig – bitte die unterschriebene Vollmacht erneut hochladen.')
    }
    try {
      uploadInhalt = await ladeDokumentBuffer(uploadPfad)
    } catch (e) {
      loggeFehler('journey', e, { route: 'abschluss', schritt: 'vollmacht_upload_laden' })
      uploadInhalt = null
    }
    if (!uploadInhalt) {
      return ungueltig('Die hochgeladene Vollmacht konnte nicht gefunden werden – bitte erneut hochladen.')
    }
  }
  let signaturBytes: Uint8Array | null = null
  let signaturPfad: string | null = null
  if (vollmacht.beantragungsweg === 'eskalator' && !uploadPfad && vollmacht.signatur_png) {
    try {
      const base64 = vollmacht.signatur_png.split(',')[1] ?? ''
      signaturBytes = Uint8Array.from(Buffer.from(base64, 'base64'))
      signaturPfad = await ladeDokumentHoch(`signatur/${angebot.angebot_nr}.png`, signaturBytes, 'image/png')
    } catch (e) {
      console.error('[journey] Signatur-Upload fehlgeschlagen:', e)
      await audit(angebot.id, 'system', 'signatur_upload', { ok: false })
    }
  }

  try {
    // 3 · Stammdaten (Abschnitte 1–5 des Zielformulars)
    // Datenkonsistenz (Berater-Prioritaet): Hat ein Admin Felder dieses
    // Vorgangs korrigiert (vorgang_revisionen, Bereich 'stammdaten'), gewinnen
    // diese Korrekturen gegenueber dem Kunden-Payload – sonst wuerde der
    // Upsert Admin-Arbeit still zuruecksetzen (Audit-Finding HIGH).
    const { data: adminRevisionen } = await db
      .from('vorgang_revisionen')
      .select('aenderungen')
      .eq('angebot_id', angebot.id)
      .eq('bereich', 'stammdaten')
      .order('created_at', { ascending: true })
    const adminKorrekturen: Record<string, unknown> = {}
    for (const rev of adminRevisionen ?? []) {
      for (const [feld, a] of Object.entries(rev.aenderungen as Record<string, { neu: unknown }>)) {
        adminKorrekturen[feld] = a.neu // chronologisch: letzte Admin-Entscheidung gewinnt
      }
    }
    const bewahrt = Object.keys(adminKorrekturen)
    if (bewahrt.length > 0) {
      await audit(angebot.id, 'system', 'admin_korrekturen_bewahrt', { felder: bewahrt })
    }

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
        // Datenkonsistenz: versteckte Felder koennen Restwerte enthalten (das
        // Schema prueft sie bewusst nicht) – personenart-fremde Werte werden
        // vor dem Insert geloescht, sonst scheitert die DB-CHECK-Constraint
        // (steuer_id ~ ^\d{11}$ bzw. bedingte Pflicht natuerlich/juristisch).
        geburtsdatum:
          String(unternehmen.personenart) === 'natuerlich' ? ((unternehmen.geburtsdatum as string) || null) : null,
        steuer_id:
          String(unternehmen.personenart) === 'natuerlich'
            ? normalisiereSteuerId(String(unternehmen.steuer_id ?? '')) || null
            : null,
        steuernummer:
          String(unternehmen.personenart) === 'natuerlich' ? null : ((unternehmen.steuernummer as string) || null),
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
        // Berater-Prioritaet: admin-korrigierte Felder zuletzt ueberlagern
        ...adminKorrekturen,
      },
      { onConflict: 'angebot_id' },
    )
    if (e1) throw new Error(`Stammdaten: ${e1.message}`)

    // 4 · Verbund (ersetzen, dann neu schreiben)
    // kennzahlen = alle BAFA-Jahre (jahrAufbauend, Skalar-Fallback fuer
    // Alt-Drafts); die Skalarspalten halten das NEUESTE Jahr – alle
    // Bestandsleser (Dossier, Fallakte, Kundenkonto, PDF) bleiben unberuehrt.
    const neuestesJahr = jahreSortiert[0].geschaeftsjahr
    await db.from('beteiligungen').delete().eq('angebot_id', angebot.id)
    if (kmu.beteiligungen.length > 0) {
      const { error: e2 } = await db.from('beteiligungen').insert(
        kmu.beteiligungen.map((b) => ({
          angebot_id: angebot.id,
          name: b.name,
          richtung: b.richtung,
          anteil_pct: b.anteil_pct,
          jae: jahrKennzahl(b, neuestesJahr, 'jae'),
          umsatz: jahrKennzahl(b, neuestesJahr, 'umsatz'),
          bilanzsumme: jahrKennzahl(b, neuestesJahr, 'bilanzsumme'),
          kennzahlen: jahreAufbauen(b, jahreSortiert.map((j) => j.geschaeftsjahr)),
          quelle: b.quelle,
          stufe: b.stufe ?? null,
          pfad: b.pfad ?? null,
          bezug: b.bezug || null,
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

    // 7 · Vollmacht / Beantragungsweg (Signatur-Upload erfolgte oben)
    const { error: e6 } = await db.from('vollmachten').upsert(
      {
        angebot_id: angebot.id,
        beantragungsweg: vollmacht.beantragungsweg,
        signatur_modus:
          vollmacht.beantragungsweg !== 'eskalator' ? null : uploadPfad ? ('upload' as const) : ('canvas' as const),
        signatur_bild_path: vollmacht.beantragungsweg === 'eskalator' && !uploadPfad ? signaturPfad : null,
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

  // 10 · Eingangsbestaetigung mit vollstaendiger Antrags-Zusammenfassung per E-Mail (best effort)
  const invest =
    (angebot.invest_software ?? 0) + (angebot.invest_messtechnik ?? 0) + (angebot.invest_steuerung ?? 0)
  // `summe` aus dem try-Block ist hier ausserhalb des Scopes – lokal neu bilden
  const deminimisSumme = deminimis.beihilfen.reduce((s, b) => s + b.betrag, 0)
  // Anhang: das hinterlegte Angebots-PDF (bevorzugt der Kunden-Upload aus
  // dem Uebersichtsschritt, sonst das vom Vertrieb archivierte Angebot).
  // Best effort – ohne Anhang geht die Bestaetigung trotzdem raus.
  let angebotAnhang: { filename: string; content: string } | null = null
  try {
    const { data: angebotDoc } = await db
      .from('dokumente')
      .select('storage_path')
      .eq('angebot_id', angebot.id)
      .eq('typ', 'angebot_pdf')
      .limit(1)
      .maybeSingle()
    const angebotPfad = angebotDoc?.storage_path ?? angebot.angebot_pdf_path ?? null
    if (angebotPfad) {
      const inhalt = await ladeDokumentBuffer(angebotPfad)
      if (inhalt && inhalt.contentType === 'application/pdf') {
        angebotAnhang = {
          filename: `Angebot-${angebot.angebot_nr}.pdf`,
          content: Buffer.from(inhalt.bytes).toString('base64'),
        }
      }
    }
  } catch (e) {
    console.error('[journey] Angebot-Anhang konnte nicht geladen werden:', e)
  }
  const mailVersand = await sendeEingangsbestaetigung({
    an: angebot.kunde_email,
    angebotAnhang,
    zusammenfassung: {
      kundeFirma: angebot.kunde_firma,
      angebotNr: angebot.angebot_nr,
      strasse: String(unternehmen.strasse),
      plz: String(unternehmen.plz),
      ort: String(unternehmen.ort),
      email: String(unternehmen.email),
      wzCode: String(unternehmen.wz_code),
      ustId: (unternehmen.ust_id as string) || null,
      apName: [ansprechpartner.ap_vorname, ansprechpartner.ap_nachname].filter(Boolean).join(' '),
      apRolle: (ansprechpartner.ap_rolle as string) || null,
      apEmail: String(ansprechpartner.ap_email),
      kmu: kmuErgebnis,
      geschaeftsjahr: jahreSortiert[0].geschaeftsjahr,
      kmuSchaetzung: !jahreSortiert[0].abgeschlossen,
      // Entwicklungsvorjahr (BAFA fragt beide Jahre ab) – kompakt in der Mail
      kmuVorjahr: bewertungen[1]
        ? { geschaeftsjahr: bewertungen[1].jahr.geschaeftsjahr, ergebnis: bewertungen[1].ergebnis }
        : null,
      technologien: angebot.technologien.map((t) => TECHNOLOGIE_LABELS[t] ?? t),
      investSumme: invest > 0 ? invest : null,
      sensorenGesamt: angebot.sensoren_gesamt,
      projektende: angebot.projektende,
      beantragungsweg: vollmacht.beantragungsweg,
      deminimisSumme,
    },
  })
  await audit(angebot.id, 'system', 'bestaetigung_email', { gesendet: mailVersand.ok, grund: mailVersand.grund ?? null })

  // 11 · Systemkonzept generieren + ablegen (best effort, blockiert den Abschluss nicht)
  // Ausnahme: Hat der Admin bereits ein kundenindividuelles Systemkonzept
  // hinterlegt (Upload/Vorlage), bleibt dieses bestehen – nicht ueberschreiben.
  try {
    const { count: vorhandenes } = await db
      .from('dokumente')
      .select('id', { count: 'exact', head: true })
      .eq('angebot_id', angebot.id)
      .eq('typ', 'systemkonzept')
    if ((vorhandenes ?? 0) > 0) {
      await audit(angebot.id, 'system', 'systemkonzept_generiert', { ok: true, uebersprungen: 'admin_vorlage' })
    } else {
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
      const url = await ladeDokumentHoch(`systemkonzept/${angebot.angebot_nr}.pdf`, pdfBytes)
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
    }
  } catch (e) {
    console.error('[journey] Systemkonzept-Generierung fehlgeschlagen:', e)
    await audit(angebot.id, 'system', 'systemkonzept_generiert', {
      ok: false,
      fehler: e instanceof Error ? e.message : String(e),
    })
  }

  // 12 · Offizielle BAFA-Vollmacht (nur bei Beantragung durch Eskalator, best effort)
  if (vollmacht.beantragungsweg === 'eskalator') {
    try {
      if (uploadPfad) {
        // Upload-Modus: Das haendisch signierte Dokument des Kunden IST die
        // Vollmacht – es wird der Akte zugeordnet (dokumente + pdf_path),
        // keine Online-Ausfuellung noetig.
        await db.from('dokumente').delete().eq('angebot_id', angebot.id).eq('typ', 'vollmacht')
        const { error: e9 } = await db.from('dokumente').insert({
          angebot_id: angebot.id,
          typ: 'vollmacht',
          storage_path: uploadPfad,
        })
        if (e9) throw new Error(`Dokumente: ${e9.message}`)
        const { error: e9b } = await db.from('vollmachten').update({ pdf_path: uploadPfad }).eq('angebot_id', angebot.id)
        if (e9b) throw new Error(`Vollmacht pdf_path: ${e9b.message}`)

        // Admin-Mail mit dem hochgeladenen Dokument (best effort, nur PDFs als
        // Anhang) – Buffer wurde oben serverseitig verifiziert (uploadInhalt).
        const inhalt = uploadInhalt
        if (inhalt && inhalt.contentType === 'application/pdf') {
          const versand = await sendeVollmachtAnAdmins({
            kundeFirma: angebot.kunde_firma,
            angebotNr: angebot.angebot_nr,
            unterzeichnetVon: vollmacht.unterschrift_name ?? null,
            pdfBytes: inhalt.bytes,
          })
          await audit(angebot.id, 'system', 'vollmacht_email_admins', {
            gesendet: versand.ok,
            grund: versand.grund ?? null,
            modus: 'upload',
          })
        }
        await audit(angebot.id, 'system', 'vollmacht_ausgefuellt', { ok: true, modus: 'upload' })
      } else {
        const vollmachtPdf = await fuelleVollmachtAus({
          unternehmensname: String(unternehmen.unternehmensname),
          strasse: String(unternehmen.strasse),
          plz: String(unternehmen.plz),
          ort: String(unternehmen.ort),
          vorgangsnummer: angebot.angebot_nr,
          unterschriftName: vollmacht.unterschrift_name ?? null,
          signaturPng: signaturBytes,
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

          // Persistenz-Vertrag: die ausgefuellte Vollmacht gehoert auch in die
          // vollmachten-Zeile (pdf_path) – Grundlage des Vollstaendigkeits-
          // Checks und der Akten-Zuordnung.
          const { error: e8b } = await db
            .from('vollmachten')
            .update({ pdf_path: url })
            .eq('angebot_id', angebot.id)
          if (e8b) throw new Error(`Vollmacht pdf_path: ${e8b.message}`)

          // Unterschriebenes PDF an die Admins senden (Empfaenger im Admin-Menue
          // konfigurierbar); best effort – die Datei bleibt im Blob/Download.
          const vollmachtVersand = await sendeVollmachtAnAdmins({
            kundeFirma: angebot.kunde_firma,
            angebotNr: angebot.angebot_nr,
            unterzeichnetVon: vollmacht.unterschrift_name ?? null,
            pdfBytes: vollmachtPdf,
          })
          await audit(angebot.id, 'system', 'vollmacht_email_admins', {
            gesendet: vollmachtVersand.ok,
            grund: vollmachtVersand.grund ?? null,
          })
        }
        await audit(angebot.id, 'system', 'vollmacht_ausgefuellt', { ok: !!url })
      }
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
