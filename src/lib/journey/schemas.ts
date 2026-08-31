import { z } from 'zod'

import type { FeldDef, SchrittDef } from './types'

/**
 * Zod-Schemas der Journey. Generische Schritte bekommen ihr Schema automatisch
 * aus den Felddefinitionen (Single Source of Truth = schritte.ts); fachliche
 * Schritte (kmu, deminimis, vollmacht) haben ein eigenes, handgepflegtes Schema.
 * Dieselben Schemas validieren client- UND serverseitig.
 */

const PFLICHT = 'Bitte ausfüllen.'

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
    case 'iban':
      return z
        .string()
        .trim()
        .min(1, PFLICHT)
        .refine((v) => {
          const norm = v.replace(/\s+/g, '').toUpperCase()
          return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(norm)
        }, 'Bitte eine gültige IBAN eingeben (z. B. DE02 …).')
    case 'auswahl':
      return z.string().min(1, 'Bitte auswählen.')
    case 'checkbox':
      return z.boolean()
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
    else if (feld.typ === 'text') s = (s as z.ZodString).min(1, PFLICHT)
    shape[feld.name] = s
  }
  return z
    .object(shape)
    .superRefine((daten, ctx) => {
      // Bedingte Pflicht: sichtbarWenn-Felder nur validieren, wenn sichtbar.
      for (const feld of schritt.felder ?? []) {
        if (!feld.sichtbarWenn || !feld.pflicht) continue
        const sichtbar = (daten as Record<string, unknown>)[feld.sichtbarWenn.feld] === feld.sichtbarWenn.ist
        const wert = (daten as Record<string, unknown>)[feld.name]
        if (sichtbar && (wert === undefined || wert === null || wert === '')) {
          ctx.addIssue({ code: 'custom', path: [feld.name], message: PFLICHT })
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
 * KMU-Schritt: Kennzahlen der letzten ZWEI abgeschlossenen Geschaeftsjahre
 * (dynamisch, nicht fest verdrahtet wie im n8n-Formular) + Verbund.
 * Die Bewertung/Foerderquote ergibt sich aus dem juengsten Jahr; das zweite
 * Jahr dokumentiert die Entwicklung (BAFA fragt beide Jahre ab).
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
    vorhaben_nicht_begonnen: z
      .boolean()
      .refine((v) => v === true, 'Ohne diese Bestätigung ist eine Förderung nicht möglich.'),
    wahrheitsgemaess: z
      .boolean()
      .refine((v) => v === true, 'Bitte bestätigen Sie die Richtigkeit Ihrer Angaben.'),
    dsgvo: z.boolean().refine((v) => v === true, 'Die Datenschutz-Einwilligung ist erforderlich.'),
  })
  .superRefine((daten, ctx) => {
    if (daten.beantragungsweg === 'eskalator' && (!daten.unterschrift_name || daten.unterschrift_name.length < 5)) {
      ctx.addIssue({
        code: 'custom',
        path: ['unterschrift_name'],
        message: 'Bitte unterschreiben Sie die Vollmacht mit Ihrem vollständigen Namen.',
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
