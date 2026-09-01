import 'server-only'

import { feldLabel } from '@/lib/admin/feld-labels'
import { formatiereWert } from '@/lib/admin/revision-diff'
import type { KundeVorgang } from '@/lib/db/repositories/kunden'
import { analysiereVerbund, CATEGORY_LABELS, type Category, type KmuResult } from '@/lib/kmu'
import {
  ANGEBOT_STATUS_LABELS,
  BEANTRAGUNGSWEG_LABELS,
  BEIHILFE_FORM_LABELS,
  BEIHILFE_STATUS_LABELS,
  GRUPPENZUGEHOERIGKEIT_LABELS,
  PERSONENART_LABELS,
  SOFTWARE_VARIANTE_LABELS,
  TECHNOLOGIE_LABELS,
  UNTERNEHMENSART_LABELS,
} from '@/lib/labels'
import { datumDE, eur, neuesPdfDokument, Writer } from '@/lib/pdf/writer'

/**
 * Fallakte-PDF (Admin/externer Fördermittelberater): vollstaendiger Auszug
 * eines Vorgangs in der Reihenfolge des BAFA-Modul-3-Formulars – inklusive
 * Verbundrechnung, De-minimis, Vollmacht und dem Audit-Report der
 * Admin-Korrekturen (wer hat wann welches Feld geaendert).
 * Dient als Ablage- und Arbeitsdokument neben der Kopier-Ansicht im Portal.
 */

const fehlt = '–'
const jaNein = (v: boolean | null | undefined) => (v == null ? fehlt : v ? 'ja' : 'nein')
const zeitDE = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('de-DE') : fehlt)

/** Kuerzt lange Werte, damit PDF-Zeilen nicht ueber den Rand laufen. */
function kurz(wert: string, max = 58): string {
  return wert.length > max ? `${wert.slice(0, max - 1)}…` : wert
}

export async function generiereFallaktePdf(v: KundeVorgang): Promise<Uint8Array> {
  const a = v.angebot
  const sd = v.stammdaten
  const kmuAktuell = v.kmuBewertungen[0] ?? null
  const berechnung = (kmuAktuell?.berechnung ?? null) as KmuResult | null

  const { doc, fett, normal } = await neuesPdfDokument(
    `Fallakte ${a.angebot_nr}`,
    `BAFA EEW Modul 3 – Fallakte ${a.kunde_firma}`,
  )
  const w = new Writer(doc, fett, normal)

  w.kopf('Fallakte', `${a.kunde_firma} · Vorgang ${a.angebot_nr}`, [
    `Status: ${ANGEBOT_STATUS_LABELS[a.status]} · Erstellt am ${zeitDE(new Date().toISOString())}`,
    'Internes Arbeitsdokument des Fördermittelberaters – vertraulich',
  ])

  // ---------- BAFA 7 · Angebot & technische Maßnahme ----------
  w.ueberschrift('1 · Angebot und technische Maßnahme (BAFA Abschnitt 7)')
  w.zeile('Angebot', `${a.angebot_nr} vom ${datumDE(a.angebot_datum)}`)
  w.zeile('Technologien', kurz(a.technologien.map((t) => TECHNOLOGIE_LABELS[t]).join(', ')))
  if (a.software_variante) w.zeile('Software-Variante', SOFTWARE_VARIANTE_LABELS[a.software_variante])
  if (a.invest_software != null) w.zeile('Invest Energiemanagementsoftware', eur(a.invest_software))
  if (a.invest_messtechnik != null) w.zeile('Invest Mess-/Sensortechnik', eur(a.invest_messtechnik))
  if (a.invest_steuerung != null) w.zeile('Invest Steuerungs-/Regelungstechnik', eur(a.invest_steuerung))
  w.zeile('Beantragte Sensoren', `${a.sensoren_gesamt ?? fehlt} (davon Prozessbezug: ${a.sensoren_prozessbezug ?? fehlt})`)
  w.zeile('Voraussichtliches Projektende', datumDE(a.projektende))
  if (a.notiz) w.zeile('Interne Notiz', kurz(a.notiz))
  w.abstand(6)

  // ---------- BAFA 1–4, 6 · Stammdaten ----------
  w.ueberschrift('2 · Stammdaten des Antragstellers (BAFA Abschnitte 1–4, 6)')
  if (sd) {
    w.zeile('Unternehmensname', kurz(sd.unternehmensname))
    w.zeile('Anschrift', kurz(`${sd.strasse}, ${sd.plz} ${sd.ort}, ${sd.land}`))
    w.zeile('E-Mail (Unternehmen)', kurz(sd.email))
    w.zeile('WZ-Code (2008)', sd.wz_code)
    w.zeile('Unternehmensart (EU)', UNTERNEHMENSART_LABELS[sd.unternehmensart])
    w.zeile('Vorsteuerabzugsberechtigt', jaNein(sd.vorsteuerabzug))
    w.zeile('Antragsteller ist eine', PERSONENART_LABELS[sd.personenart])
    if (sd.personenart === 'natuerlich') {
      w.zeile('Geburtsdatum', datumDE(sd.geburtsdatum))
      w.zeile('Steuer-ID (11-stellig)', sd.steuer_id ?? fehlt)
    } else {
      w.zeile('Steuernummer', sd.steuernummer ?? fehlt)
      w.zeile('USt-IdNr.', sd.ust_id ?? fehlt)
    }
    w.zeile(
      'Ansprechpartner',
      kurz(`${[sd.ap_anrede, sd.ap_vorname, sd.ap_nachname].filter(Boolean).join(' ') || fehlt} (${sd.ap_rolle ?? fehlt})`),
    )
    w.zeile('E-Mail (Ansprechpartner)', sd.ap_email ?? fehlt)
    w.zeile('Gruppenzugehörigkeit', GRUPPENZUGEHOERIGKEIT_LABELS[sd.gruppenzugehoerigkeit])
    w.zeile('Wirtschaftlich tätig', jaNein(sd.wirtschaftlich_taetig))
    w.zeile('Kontoinhaber', sd.kontoinhaber ?? fehlt)
    w.zeile('IBAN', sd.iban ?? fehlt)
    w.zeile(
      'Standort der Maßnahme',
      sd.standort_plz || sd.standort_ort || sd.standort_strasse
        ? kurz(`${sd.standort_strasse ?? ''}, ${sd.standort_plz ?? ''} ${sd.standort_ort ?? ''}`.trim())
        : 'Wie Firmenanschrift',
    )
    w.zeile('Vorhaben noch nicht begonnen', jaNein(sd.vorhaben_nicht_begonnen))
    w.zeile('DSGVO-Einwilligung erteilt am', zeitDE(sd.dsgvo_einwilligung_at))
  } else {
    w.absatz('Noch keine Stammdaten eingereicht – der Kunde hat die Journey nicht abgeschlossen.', 9.5)
  }
  w.abstand(6)

  // ---------- BAFA 5 · KMU ----------
  w.ueberschrift('3 · KMU-Einstufung (BAFA Abschnitt 5 · EU 2003/361/EG)')
  if (v.kmuBewertungen.length > 0) {
    for (const k of v.kmuBewertungen) {
      w.zeile(
        `Geschäftsjahr ${k.geschaeftsjahr}${k.abgeschlossen ? '' : ' (laufend)'}`,
        kurz(
          `${k.jae ?? fehlt} JAE · Umsatz ${eur(k.umsatz)} · Bilanz ${eur(k.bilanzsumme)}` +
            (k.kategorie
              ? ` -> ${CATEGORY_LABELS[k.kategorie as Category] ?? k.kategorie} · ${k.foerderquote_pct} %`
              : ''),
        ),
      )
    }
    if (berechnung) {
      w.abstand(4)
      w.absatz(`Verbundrechnung (konsolidiert, Geschäftsjahr ${kmuAktuell?.geschaeftsjahr ?? '–'}):`, 9.5)
      w.zeile(
        'Eigenes Unternehmen',
        kurz(
          `${berechnung.own.employees.toLocaleString('de-DE')} JAE · ${eur(berechnung.own.turnover)} · ${eur(berechnung.own.balanceSheet)}`,
        ),
      )
      w.zeile(
        '+ Partnerunternehmen (anteilig)',
        kurz(
          `${berechnung.partnerContribution.employees.toLocaleString('de-DE')} JAE · ${eur(berechnung.partnerContribution.turnover)} · ${eur(berechnung.partnerContribution.balanceSheet)}`,
        ),
      )
      w.zeile(
        '+ Verbundene Unternehmen (100 %)',
        kurz(
          `${berechnung.linkedContribution.employees.toLocaleString('de-DE')} JAE · ${eur(berechnung.linkedContribution.turnover)} · ${eur(berechnung.linkedContribution.balanceSheet)}`,
        ),
      )
      w.zeile(
        '= Verbundgröße (maßgeblich)',
        kurz(
          `${berechnung.consolidated.employees.toLocaleString('de-DE')} JAE · ${eur(berechnung.consolidated.turnover)} · ${eur(berechnung.consolidated.balanceSheet)}`,
        ),
      )
      for (const grund of berechnung.reasons) w.absatz(`· ${grund}`, 8.5)
    }
  } else {
    w.absatz('Noch keine KMU-Bewertung eingereicht.', 9.5)
  }

  if (v.beteiligungen.length > 0) {
    w.abstand(4)
    const zeilen = analysiereVerbund(
      sd?.unternehmensname ?? '',
      v.beteiligungen.map((b, i) => ({
        id: b.id ?? `b${i}`,
        name: b.name,
        sharePct: b.anteil_pct,
        employees: b.jae ?? 0,
        turnover: b.umsatz ?? 0,
        balanceSheet: b.bilanzsumme ?? 0,
        bezug: b.bezug ?? undefined,
      })),
    )
    w.absatz('Partner- und verbundene Unternehmen (inkl. Beteiligungsketten):', 9.5)
    for (const b of v.beteiligungen) {
      const z = zeilen.find((x) => x.name === b.name.trim())
      const zurechnung = !z
        ? fehlt
        : z.art === 'verbunden'
          ? z.tiefe > 1
            ? '100 % (verbunden über Kette)'
            : '100 % (verbunden)'
          : z.art === 'partner'
            ? `${Math.round(z.effektivPct)} % (Partner)`
            : 'keine Verrechnung'
      w.zeile(
        kurz(`${b.name} (${b.anteil_pct} %, ${b.richtung === 'aufwaerts' ? 'an uns' : 'unsere'})`, 52),
        kurz(
          `${zurechnung} · ${b.jae ?? fehlt} JAE · Umsatz ${eur(b.umsatz)} · Bilanz ${eur(b.bilanzsumme)}`,
        ),
      )
      if (b.pfad) w.absatz(`  Kette: ${b.pfad}`, 8.5)
    }
  }
  w.abstand(6)

  // ---------- De-minimis ----------
  w.ueberschrift('4 · De-minimis-Erklärung (VO (EU) 2023/2831)')
  if (v.deminimis) {
    w.zeile('Fusion / Übernahme / Aufspaltung (3 Jahre)',
      `${jaNein(v.deminimis.fusion_3j)} / ${jaNein(v.deminimis.uebernahme_3j)} / ${jaNein(v.deminimis.aufspaltung_3j)}`)
    w.zeile('Beihilfen gesamt (3 Jahre)', eur(v.deminimis.summe_eur))
    w.zeile('Verbleibender Spielraum (300.000 EUR)', eur(Math.max(0, 300_000 - v.deminimis.summe_eur)))
    w.zeile('Bestätigt am (§ 264 StGB-Hinweis)', zeitDE(v.deminimis.bestaetigt_at))
    for (const b of v.beihilfen) {
      w.zeile(
        kurz(`${b.beihilfegeber}${b.aktenzeichen ? ` (${b.aktenzeichen})` : ''}`, 52),
        kurz(`${eur(b.betrag)} · ${BEIHILFE_FORM_LABELS[b.form]} · ${datumDE(b.bewilligt_am)} · ${BEIHILFE_STATUS_LABELS[b.status]}`),
      )
    }
  } else {
    w.absatz('Noch keine De-minimis-Erklärung eingereicht.', 9.5)
  }
  w.abstand(6)

  // ---------- BAFA 8 · Vollmacht ----------
  w.ueberschrift('5 · Beantragungsweg und Vollmacht (BAFA Abschnitt 8)')
  if (v.vollmacht) {
    w.zeile('Beantragungsweg', BEANTRAGUNGSWEG_LABELS[v.vollmacht.beantragungsweg])
    if (v.vollmacht.beantragungsweg === 'eskalator') {
      w.zeile('Vollmacht erteilt durch', v.vollmacht.unterzeichnet_von ?? fehlt)
      w.zeile('Unterzeichnet am', zeitDE(v.vollmacht.unterzeichnet_at))
    }
  } else {
    w.absatz('Noch kein Beantragungsweg gewählt.', 9.5)
  }
  w.abstand(6)

  // ---------- Kunden-Zugriffsprotokoll ----------
  w.ueberschrift(`6 · Kunden-Zugriffe (Login-Protokoll)`)
  if (v.zugriffe.anzahl > 0) {
    w.zeile('Aufrufe gesamt', String(v.zugriffe.anzahl))
    w.zeile('Zuletzt aufgerufen', zeitDE(v.zugriffe.liste[0]?.created_at))
    for (const z of v.zugriffe.liste.slice(0, 10)) {
      w.zeile(zeitDE(z.created_at), kurz(`${z.ip ?? fehlt} · ${z.user_agent ?? fehlt}`))
    }
    if (v.zugriffe.anzahl > 10) w.absatz(`… und ${v.zugriffe.anzahl - 10} weitere Aufrufe.`, 8.5)
  } else {
    w.absatz('Der Kunde hat den Link noch nicht aufgerufen.', 9.5)
  }
  w.abstand(6)

  // ---------- Audit-Report ----------
  w.ueberschrift(`7 · Änderungshistorie durch Admins (${v.revisionen.length})`)
  if (v.revisionen.length > 0) {
    for (const r of v.revisionen) {
      const wer = v.bearbeiter[r.bearbeitet_von] ?? r.bearbeitet_von
      w.absatz(
        `${zeitDE(r.created_at)} · ${wer} · Bereich: ${r.bereich === 'angebot' ? 'Angebot' : 'Stammdaten'}`,
        9,
      )
      for (const [feld, a] of Object.entries(r.aenderungen)) {
        w.zeile(feldLabel(feld), kurz(`${formatiereWert(a.alt)} -> ${formatiereWert(a.neu)}`))
      }
    }
  } else {
    w.absatz('Keine Admin-Korrekturen protokolliert.', 9.5)
  }

  w.abstand(8)
  w.absatz(
    'Hinweis: Diese Fallakte wurde automatisiert aus dem MABE Förderportal erstellt und gibt den Stand der ' +
      'gespeicherten Angaben inklusive aller Admin-Korrekturen wieder. Maßgeblich für die Antragstellung sind ' +
      'die im FZD-Portal eingereichten Daten. Vertraulich – nur für den internen Gebrauch des ' +
      'Fördermittelberaters und der MABE Maschinen- und Behälterbau GmbH.',
    8.5,
  )

  w.fusszeile(`MABE Förderportal · Fallakte ${a.angebot_nr} · ${a.kunde_firma}`)
  return doc.save()
}
