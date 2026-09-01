/**
 * Zentrale Eingabe-Validierung (framework-frei, client- UND serverseitig nutzbar).
 *
 * Belegte Verfahren:
 * - IBAN: ISO 13616 – laenderspezifische Gesamtlaenge + MOD-97-Pruefsumme
 *   (Laengen aus dem offiziellen IBAN-Registry, SWIFT).
 * - Steuer-ID (IdNr): 11 Ziffern, Pruefziffer nach ISO 7064 MOD 11,10
 *   (Verfahren des Bundeszentralamts fuer Steuern / ELSTER).
 * - USt-IdNr.: DE + 9 Ziffern (Bundeszentralamt fuer Steuern; keine
 *   oeffentliche Pruefziffer, daher Formatpruefung).
 * - WZ-Code: Klassifikation der Wirtschaftszweige 2008 (Destatis) –
 *   Abschnittsbuchstabe A-U oder gepunktete Ziffernstruktur.
 * - Steuernummer: bundeslandabhaengig, daher bewusst tolerante Formatpruefung.
 */

// ---------- IBAN (ISO 13616) ----------

/** Gesamtlaenge der IBAN je Land (IBAN-Registry, Stand 2024). */
const IBAN_LAENGEN: Record<string, number> = {
  AL: 28, AD: 24, AT: 20, AZ: 28, BH: 22, BE: 16, BA: 20, BR: 29, BG: 22, CR: 22, HR: 21, CY: 28, CZ: 24, DK: 18,
  DO: 28, TL: 23, EE: 20, FO: 18, FI: 18, FR: 27, GE: 22, DE: 22, GI: 23, GR: 27, GL: 18, GT: 28, HU: 28, IS: 26,
  IE: 22, IL: 23, IT: 27, JO: 30, KZ: 20, XK: 20, KW: 30, LV: 21, LB: 28, LI: 21, LT: 20, LU: 20, MT: 31, MR: 27,
  MU: 30, MC: 27, MD: 24, ME: 22, NL: 18, MK: 19, NO: 15, PK: 24, PS: 29, PL: 28, PT: 25, QA: 29, RO: 24, SM: 27,
  SA: 24, RS: 22, SC: 31, SK: 24, SI: 19, ES: 24, LY: 25, SD: 18, SE: 24, CH: 21, TN: 24, TR: 26, UA: 29, AE: 23,
  GB: 22, VA: 22, VG: 24, EG: 29, IQ: 23, SO: 23, BY: 28, DZ: 26, AO: 25, BJ: 28, BF: 28, BI: 28, CM: 27, CV: 25,
  IR: 26, CI: 28, MG: 27, ML: 28, MZ: 25, SN: 28, TG: 28, CF: 27, TD: 27, CG: 27, GA: 27, KM: 27, GQ: 27, DJ: 27,
  NE: 28, MA: 28, NI: 32, ST: 25, HN: 28, SV: 28, MN: 20, RU: 33, LC: 32, OM: 23, YE: 30, BS: 27, SZ: 27, NA: 27,
}

export interface PruefErgebnis {
  ok: boolean
  /** Verstaendliche Fehlermeldung (deutsch), wenn ok === false. */
  fehler?: string
}

/** Entfernt Leerzeichen und vereinheitlicht Grossschreibung. */
export function normalisiereIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase()
}

/** Formatiert eine IBAN zur Anzeige in Vierergruppen. */
export function formatiereIban(iban: string): string {
  return normalisiereIban(iban)
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

/** MOD-97-Pruefsumme nach ISO 13616 (Zeichenweise, ohne BigInt). */
function ibanMod97(iban: string): number {
  const neu = iban.slice(4) + iban.slice(0, 4)
  let rest = 0
  for (const zeichen of neu) {
    const code = zeichen.charCodeAt(0)
    const ziffern =
      code >= 48 && code <= 57 // 0-9
        ? zeichen
        : String(code - 55) // A=10 … Z=35
    for (const z of ziffern) rest = (rest * 10 + (z.charCodeAt(0) - 48)) % 97
  }
  return rest
}

/**
 * Prueft eine IBAN vollstaendig: Zeichenvorrat, bekanntes Land,
 * laenderspezifische Laenge und MOD-97-Pruefziffer.
 */
export function pruefeIban(eingabe: string): PruefErgebnis {
  const iban = normalisiereIban(eingabe)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) {
    // Beispiel ist eine echt gueltige IBAN (MOD-97), sonst kopiert der Kunde
    // die Vorlage und bekommt sofort den naechsten Fehler.
    return { ok: false, fehler: 'Bitte eine IBAN eingeben (z. B. DE02 1203 0000 0000 2020 51).' }
  }
  const land = iban.slice(0, 2)
  const laenge = IBAN_LAENGEN[land]
  if (!laenge) {
    return { ok: false, fehler: `Der Ländercode „${land}“ gehört zu keiner gültigen IBAN.` }
  }
  if (iban.length !== laenge) {
    return {
      ok: false,
      fehler: `Eine ${land}-IBAN hat ${laenge} Stellen – Ihre Eingabe hat ${iban.length}.`,
    }
  }
  if (ibanMod97(iban) !== 1) {
    return {
      ok: false,
      fehler: 'Die Prüfziffer der IBAN stimmt nicht – bitte Zahlendreher prüfen.',
    }
  }
  return { ok: true }
}

// ---------- Steuer-ID / IdNr (ISO 7064 MOD 11,10) ----------

/**
 * Pruefziffer der 11-stelligen Identifikationsnummer (BZSt/ELSTER-Verfahren).
 * @param zehn Erste 10 Ziffern als String.
 */
export function steuerIdPruefziffer(zehn: string): number {
  let produkt = 10
  for (let i = 0; i < 10; i++) {
    let summe = (Number(zehn[i]) + produkt) % 10
    if (summe === 0) summe = 10
    produkt = (summe * 2) % 11
  }
  const pruef = 11 - produkt
  return pruef === 10 ? 0 : pruef
}

/**
 * Prueft die persoenliche Steuer-ID: 11 Ziffern, erste Ziffer ≠ 0,
 * Wiederholungsregel (in den ersten 10 Ziffern darf hoechstens eine Ziffer
 * mehrfach – max. 3× – vorkommen) und gueltige Pruefziffer.
 */
/** Entfernt Leerzeichen/Trennzeichen – SPEICHERFORMAT ist die reine Ziffernfolge (DB-CHECK ^\d{11}$). */
export function normalisiereSteuerId(eingabe: string): string {
  return eingabe.replace(/[\s./-]/g, '')
}

export function pruefeSteuerId(eingabe: string): PruefErgebnis {
  const id = normalisiereSteuerId(eingabe)
  if (!/^\d{11}$/.test(id)) {
    return { ok: false, fehler: 'Die Steuer-ID hat genau 11 Ziffern (steht auf dem Einkommensteuerbescheid).' }
  }
  if (id[0] === '0') {
    return { ok: false, fehler: 'Die Steuer-ID beginnt nie mit einer 0 – bitte prüfen.' }
  }
  // Wiederholungsregel: genau eine Ziffer darf 2- oder 3-mal vorkommen,
  // alle anderen hoechstens einmal (in den ersten 10 Ziffern).
  const zaehler = new Map<string, number>()
  for (const z of id.slice(0, 10)) zaehler.set(z, (zaehler.get(z) ?? 0) + 1)
  let mehrfach = 0
  for (const n of zaehler.values()) {
    if (n > 3) return { ok: false, fehler: 'Diese Steuer-ID ist keine gültige Identifikationsnummer.' }
    if (n > 1) mehrfach++
  }
  if (mehrfach > 1) {
    return { ok: false, fehler: 'Diese Steuer-ID ist keine gültige Identifikationsnummer.' }
  }
  if (steuerIdPruefziffer(id.slice(0, 10)) !== Number(id[10])) {
    return { ok: false, fehler: 'Die Prüfziffer der Steuer-ID stimmt nicht – bitte Zahlendreher prüfen.' }
  }
  return { ok: true }
}

// ---------- USt-IdNr. ----------

/** Deutsche Umsatzsteuer-Identifikationsnummer: DE + 9 Ziffern. */
export function pruefeUstId(eingabe: string): PruefErgebnis {
  const ust = eingabe.replace(/\s+/g, '').toUpperCase()
  if (!/^DE\d{9}$/.test(ust)) {
    return { ok: false, fehler: 'Die USt-IdNr. beginnt mit „DE“ gefolgt von 9 Ziffern.' }
  }
  return { ok: true }
}

// ---------- WZ-Code 2008 ----------

/**
 * Klassifikation der Wirtschaftszweige 2008: Abschnitt (A-U) oder
 * gepunktete Hierarchie, z. B. „28“, „28.2“, „28.29“, „28.29.1“, „28.29.12“.
 */
export function pruefeWzCode(eingabe: string): PruefErgebnis {
  const wz = eingabe.trim().toUpperCase()
  if (!/^([A-U]|\d{2}(\.\d{1,2}){0,2})$/.test(wz)) {
    return { ok: false, fehler: 'Bitte den WZ-Code 2008 eingeben (z. B. „28.29“ oder „C“).' }
  }
  return { ok: true }
}

// ---------- Steuernummer (juristische Personen) ----------

/**
 * Steuernummern sind je nach Finanzamt unterschiedlich aufgebaut
 * (Bundesschema: 13 Ziffern). Bewusst tolerant: Ziffern mit ueblichen
 * Trennzeichen, insgesamt 10–13 Ziffern.
 */
export function pruefeSteuernummer(eingabe: string): PruefErgebnis {
  const sn = eingabe.trim()
  if (!/^[\d][\d/\-\s]*$/.test(sn)) {
    return { ok: false, fehler: 'Die Steuernummer besteht aus Ziffern (z. B. 123/456/78901).' }
  }
  const ziffern = sn.replace(/\D/g, '')
  if (ziffern.length < 10 || ziffern.length > 13) {
    return { ok: false, fehler: 'Die Steuernummer hat 10 bis 13 Ziffern – bitte Finanzamt-Schreiben prüfen.' }
  }
  return { ok: true }
}
