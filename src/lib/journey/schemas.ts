import { z } from 'zod'

import { pruefeIban, pruefeSteuerId, pruefeSteuernummer, pruefeUstId, pruefeWzCode } from '@/lib/validierung'
import type { FeldDef, FeldTyp, SchrittDef } from './types'

/**
 * Zod-Schemas der Journey. Generische Schritte bekommen ihr Schema automatisch
 * aus den Felddefinitionen (Single Source of Truth = schritte.ts); fachliche
 * Schritte (kmu, deminimis, vollmacht) haben ein eigenes, handgepflegtes Schema.
 * Dieselben Schemas validieren client- UND serverseitig.
 *
 * Formatpruefungen (IBAN, Steuer-ID, USt-IdNr., WZ-Code, Steuernummer) laufen
 * sichtbarkeitsbewusst in der superRefine: Ausgeblendete Felder (sichtbarWenn)
 * blockieren nie, sichtbare Felder werden erst geprueft, wenn sie gefuellt sind.
 */

const PFLICHT = 'Bitte ausfüllen.'

/** Feldtypen mit fachlicher Formatpruefung (src/lib/validierung.ts). */
const FORMAT_TYPEN = new Set<FeldTyp>(['iban', 'steuer_id', 'ust_id', 'wz_code', 'steuernummer'])

/** Liefert die verstaendliche Fehlermeldung einer Formatpruefung oder null. */
function formatFehler(typ: FeldTyp, wert: unknown): string | null {
  if (wert === undefined || wert === null || String(wert).trim() === '') return null
  const s = String(wert).trim()
  switch (typ) {
    case 'iban':
      return pruefeIban(s).fehler ?? null
    case 'steuer_id':
      return pruefeSteuerId(s).fehler ?? null
    case 'ust_id':
      return pruefeUstId(s).fehler ?? null
    case 'wz_code':
      return pruefeWzCode(s).fehler ?? null
    case 'steuernummer':
      return pruefeSteuernummer(s).fehler ?? null
    default:
      return null
  }
}

function feldSchema(feld: FeldDef): z.ZodTypeAny {
  switch (feld.typ) {
    case 'email':
      return z.email('Bitte eine gültige E-Mail-Adresse eingeben.')
    case 'zahl':
      return z.coerce.number('Bitte eine Zahl eingeben.').min(0, 'Darf nicht negativ sein.')
    case 'datum':
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte ein Datum wählen.')
    case 'plz':
      return z.string().trim().regex(/^\d{5}$/, 'Bitte eine 5-stellige PLZ eingeben.')
    case 'auswahl': {
      // Serverseitige Integritaet: nur definierte Optionswerte sind erlaubt
      // (Schutz vor manipulierten Payloads, z. B. land != „Deutschland").
      const werte = (feld.optionen ?? []).map((o) => o.wert)
      return werte.length > 0
        ? z.enum(werte as [string, ...string[]], 'Bitte einen gültigen Wert auswählen.')
        : z.string().min(1, 'Bitte auswählen.')
    }
    case 'checkbox':
      return z.boolean()
    // IBAN & Co.: Basisschema ist Text; die Formatpruefung (inkl. Pruefziffern)
    // laeuft sichtbarkeitsbewusst in der superRefine unten.
    case 'iban':
    case 'steuer_id':
    case 'ust_id':
    case 'wz_code':
    case 'steuernummer':
    case 'text':
    default:
      return z.string().trim()
  }
}

/** Baut das Zod-Objektschema eines generischen Schritts aus seinen Feldern. */
export function schemaFuerGenerischenSchritt(schritt: SchrittDef) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const feld of schritt.felder ?? []) {
    let s = feldSchema(feld)
    // Optional wenn nicht pflicht ODER nur bedingt sichtbar (sichtbarWenn);
    // die bedingte Pflicht erzwingt die superRefine unten.
    if (!feld.pflicht || feld.sichtbarWenn) s = s.optional().or(z.literal('').transform(() => undefined))
    else if (
      feld.typ === 'text' ||
      feld.typ === 'iban' ||
      feld.typ === 'steuer_id' ||
      feld.typ === 'ust_id' ||
      feld.typ === 'wz_code' ||
      feld.typ === 'steuernummer'
    )
      s = (s as z.ZodString).min(1, PFLICHT)
    shape[feld.name] = s
  }
  return z
    .object(shape)
    .superRefine((daten, ctx) => {
      const werte = daten as Record<string, unknown>
      for (const feld of schritt.felder ?? []) {
        const sichtbar = !feld.sichtbarWenn || werte[feld.sichtbarWenn.feld] === feld.sichtbarWenn.ist
        if (!sichtbar) continue
        const wert = werte[feld.name]
        // Bedingte Pflicht: sichtbarWenn-Felder nur validieren, wenn sichtbar.
        if (feld.sichtbarWenn && feld.pflicht && (wert === undefined || wert === null || wert === '')) {
          ctx.addIssue({ code: 'custom', path: [feld.name], message: PFLICHT })
          continue
        }
        // Formatpruefung (IBAN-Pruefziffer, Steuer-ID, …) fuer sichtbare, gefuellte Felder.
        if (FORMAT_TYPEN.has(feld.typ)) {
          const fehler = formatFehler(feld.typ, wert)
          if (fehler) ctx.addIssue({ code: 'custom', path: [feld.name], message: fehler })
        }
      }
    })
    .strip()
}

// ---------- Fachliche Schritte ----------

export const beteiligungSchema = z.object({
  name: z.string().trim().min(1, 'Name des Beteiligungsunternehmens fehlt.'),
  richtung: z.enum(['abwaerts', 'aufwaerts']),
  anteil_pct: z.coerce.number('Beteiligung in % fehlt.').min(25, 'Unter 25 % bitte weglassen.').max(100),
  jae: z.coerce.number().min(0).optional(),
  umsatz: z.coerce.number().min(0).optional(),
  bilanzsumme: z.coerce.number().min(0).optional(),
  quelle: z.enum(['manuell', 'openregister']).default('manuell'),
  /** Kettentiefe (1 = direkt); nur bei OpenRegister-Vorbefuellung gesetzt. */
  stufe: z.coerce.number().int().min(1).optional(),
  /** Letzte Kante der Beteiligungskette, z. B. „X hält 80 % an Y GmbH". */
  pfad: z.string().optional(),
  /** Bezugsunternehmen der Kante (leer/undefined = Antragsteller, Stufe 1). */
  bezug: z.string().trim().optional(),
})

export const kmuJahrSchema = z.object({
  geschaeftsjahr: z.coerce.number().int().min(2000).max(2100),
  abgeschlossen: z.boolean().default(true),
  jae: z.coerce.number('Jahresarbeitseinheiten fehlen.').min(0),
  umsatz: z.coerce.number().min(0).default(0),
  bilanzsumme: z.coerce.number().min(0).default(0),
})
export type KmuJahrDaten = z.infer<typeof kmuJahrSchema>

/**
 * KMU-Schritt: Kennzahlen der Geschaeftsjahre 2025 und 2024 – fest, wie das
 * BAFA-Portal sie abfragt (siehe BAFA_GESCHAEFTSJAHRE in schritt-kmu.tsx).
 * Die Bewertung/Foerderquote ergibt sich aus dem juengsten Jahr (2025); das
 * Jahr 2024 dokumentiert die Entwicklung (BAFA fragt beide Jahre ab).
 */
export const kmuSchema = z.object({
  jahre: z.array(kmuJahrSchema).length(2, 'Bitte die Kennzahlen beider Geschäftsjahre ausfüllen.'),
  /**
   * Leitfrage „Steht Ihr Unternehmen in Beteiligungsverhältnissen?" –
   * false erzwingt serverseitig einen leeren Verbund (Datenkonsistenz,
   * auch wenn der Client veraltete Zeilen mitschickt).
   */
  hat_beteiligungen: z.boolean().optional(),
  beteiligungen: z.array(beteiligungSchema).default([]),
})
export type KmuSchrittDaten = z.infer<typeof kmuSchema>

export const beihilfeSchema = z.object({
  beihilfegeber: z.string().trim().min(1, 'Beihilfegeber fehlt.'),
  aktenzeichen: z.string().trim().optional(),
  bewilligt_am: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum fehlt.'),
  betrag: z.coerce.number('Betrag fehlt.').min(0),
  form: z.enum(['zuschuss', 'darlehen', 'buergschaft']),
  kategorie: z.enum(['allgemein', 'agrar', 'fisch']).default('allgemein'),
  status: z.enum(['gewaehrt', 'beantragt']),
})

export const deminimisSchema = z.object({
  beihilfen: z.array(beihilfeSchema).default([]),
  fusion_3j: z.boolean().default(false),
  uebernahme_3j: z.boolean().default(false),
  aufspaltung_3j: z.boolean().default(false),
  bestaetigt: z
    .boolean()
    .refine((v) => v === true, 'Bitte bestätigen Sie die Vollständigkeit Ihrer Angaben (§ 264 StGB-Hinweis).'),
})
export type DeminimisSchrittDaten = z.infer<typeof deminimisSchema>

export const vollmachtSchema = z
  .object({
    beantragungsweg: z.enum(['selbst', 'eskalator']),
    unterschrift_name: z.string().trim().optional(),
    /**
     * Gezeichnete Unterschrift als PNG-Data-URL (Signatur-Pad). Wird in das
     * BAFA-Formular eingezeichnet und zusaetzlich als Bild im Blob archiviert.
     */
    signatur_png: z
      .string()
      .startsWith('data:image/png;base64,', 'Unterschrift konnte nicht gelesen werden.')
      .max(400_000, 'Unterschrift ist zu groß – bitte erneut zeichnen.')
      .optional(),
    vorhaben_nicht_begonnen: z
      .boolean()
      .refine((v) => v === true, 'Ohne diese Bestätigung ist eine Förderung nicht möglich.'),
    wahrheitsgemaess: z
      .boolean()
      .refine((v) => v === true, 'Bitte bestätigen Sie die Richtigkeit Ihrer Angaben.'),
    dsgvo: z.boolean().refine((v) => v === true, 'Die Datenschutz-Einwilligung ist erforderlich.'),
  })
  .superRefine((daten, ctx) => {
    if (daten.beantragungsweg !== 'eskalator') return
    if (!daten.unterschrift_name || daten.unterschrift_name.length < 5) {
      ctx.addIssue({
        code: 'custom',
        path: ['unterschrift_name'],
        message: 'Bitte geben Sie Ihren vollständigen Namen als Unterzeichner/in an.',
      })
    }
    if (!daten.signatur_png) {
      ctx.addIssue({
        code: 'custom',
        path: ['signatur_png'],
        message: 'Bitte zeichnen Sie Ihre Unterschrift in das Unterschriftsfeld.',
      })
    }
  })
export type VollmachtSchrittDaten = z.infer<typeof vollmachtSchema>

/** Liefert das passende Schema fuer einen Schritt (generisch oder fachlich). */
export function schemaFuerSchritt(schritt: SchrittDef): z.ZodTypeAny {
  switch (schritt.komponente) {
    case 'kmu':
      return kmuSchema
    case 'deminimis':
      return deminimisSchema
    case 'vollmacht':
      return vollmachtSchema
    case 'uebersicht':
      return z.object({}).strip()
    default:
      return schemaFuerGenerischenSchritt(schritt)
  }
}
