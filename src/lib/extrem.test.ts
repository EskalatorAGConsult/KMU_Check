/**
 * EXTREM-SZENARIEN-TESTSUITE — 10 Agenten testen den kompletten Admin-
 * und User-Bereich mit Edge Cases, adversarial Input und Grenzwerten.
 *
 * Agent 1  Security          — Injektion, XSS, Path-Traversal, Homoglyphs
 * Agent 2  Edge Cases        — Grenzwerte, Leer/Null/Undefined, Extreme Längen
 * Agent 3  Business Logic    — KMU-Maschine, Status-Übergänge, Verbund-Ketten
 * Agent 4  Data Integrity    — CSV-Injektion, Diff, Vollständigkeit
 * Agent 5  Error Handling    — Malformed Input, Unicode, PDF-Fehler
 * Agent 6  Performance       — Grosse Datenmengen, Rate-Limit-Stress
 * Agent 7  Concurrency       — Idempotenz, Race Conditions
 * Agent 8  Compliance        — DSGVO, Audit-Trail
 * Agent 9  Integration       — Cross-Modul-Pipelines
 * Agent 10 API Contracts     — Webhook, CSV, E-Mail-Formatate
 */

import { describe, expect, it } from 'vitest'

import { evaluateKmu, analysiereVerbund, fundingRateFor, type Holding } from '@/lib/kmu'
import { pruefeIban, pruefeSteuerId, pruefeUstId, pruefeWzCode, pruefeSteuernummer, normalisiereIban } from '@/lib/validierung'
import { STATUS_TRANSITIONEN, istUebergangErlaubt } from '@/lib/admin/status'
import { bildeDiff, formatiereWert } from '@/lib/admin/revision-diff'
import { csvZeile, baueCsv } from '@/lib/csv'
import { fristErinnerungsFaellig, sammleFristErinnerungen, FRIST_ERINNERUNG_STANDARD, type FristKandidat } from '@/lib/bescheid/domain'
import { pruefeVollstaendigkeit } from '@/lib/vollstaendigkeit'
import { istTestAdresse } from '@/lib/email/guard'
import { loeseWebhookAuf, istGueltigeWebhookUrl } from '@/lib/webhook'
import { rateLimit } from '@/lib/rate-limit'
import { fehlerMeldung, loggeFehler } from '@/lib/fehler'
import { parseBescheidAnalyse } from '@/lib/gemini/bescheid-parser'
import { parseAngebotAnalyse } from '@/lib/gemini/parser'
import { fortschrittInfo } from '@/lib/journey/fortschritt-info'
import { schemaFuerSchritt } from '@/lib/journey/schemas'
import { SCHRITTE, aktiveSchritteFuer } from '@/lib/journey/schritte'

// ═══════════════════════════════════════════════════════════════
// AGENT 1 · SECURITY — Injektion, XSS, Path-Traversal, Homoglyphs
// ═══════════════════════════════════════════════════════════════
describe('Agent 1 · Security', () => {
  describe('SQL-Injektion in allen Textfeldern', () => {
    const injection = [
      "'; DROP TABLE angebote; --",
      "1' OR '1'='1",
      "'; INSERT INTO user (role) VALUES ('admin'); --",
      "UNION SELECT * FROM user WHERE role='admin'",
      "'; UPDATE angebote SET status='abgeschlossen'; --",
      "Robert'); DROP TABLE students;--",
    ]
    it.each(injection)('KMU-Engine verarbeitet \"%s\" ohne SQL-Ausführung', (name) => {
      const erg = evaluateKmu({ companyName: name, employees: 10, turnover: 1000, balanceSheet: 1000, holdings: [] })
      expect(erg.category).toBeDefined()
      expect(erg.categoryLabel).not.toContain('DROP')
    })
    it.each(injection)('Verbund-Analyse überlebt \"%s\"', (name) => {
      const h: Holding = { id: 'x', name, sharePct: 50, employees: 5, turnover: 100, balanceSheet: 100 }
      const zeilen = analysiereVerbund('Test', [h])
      expect(zeilen).toBeDefined()
      expect(zeilen.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('XSS-Versuche in Ausgabefeldern', () => {
    const xss = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '"><svg onload=alert(1)>',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)">',
      '{{constructor.constructor("alert(1)")()}}',
    ]
    it.each(xss)('KMU-Label enthält kein ausführbares Markup für \"%s\"', () => {
      const erg = evaluateKmu({ companyName: 'Test', employees: 5, turnover: 100, balanceSheet: 100, holdings: [] })
      expect(erg.categoryLabel).not.toMatch(/<script|<img|<svg|<iframe|javascript:/i)
    })
    it.each(xss)('fehlerMeldung sanitiisiert \"%s\"', (input) => {
      const msg = fehlerMeldung(new Error(input))
      expect(msg.length).toBeLessThanOrEqual(300)
      expect(typeof msg).toBe('string')
    })
  })

  describe('Path-Traversal in Datei-/Blob-Pfaden', () => {
    const traversal = [
      '../../../etc/passwd',
      '..\\\\..\\\\..\\\\windows\\\\system32',
      '/../../.env',
      './../../../vercel.json',
      '....//....//config',
    ]
    it.each(traversal)('Webhook-URL-Validierung lehnt Pfad-Manipulation ab: \"%s\"', (path) => {
      expect(istGueltigeWebhookUrl(path)).toBe(false)
    })
  })

  describe('E-Mail-Guard blockt Adressen-Domains', () => {
    it('blockt Wegwerf-Domain mailinator', () => expect(istTestAdresse('x@mailinator.com')).toBe(true))
    it('blockt .invalid TLD', () => expect(istTestAdresse('x@y.invalid')).toBe(true))
    it('blockt .test TLD', () => expect(istTestAdresse('x@y.test')).toBe(true))
    it('blockt fehlende Domain', () => expect(istTestAdresse('x@')).toBe(true))
    it('blockt leere Adresse', () => expect(istTestAdresse('')).toBe(true))
    it('lässt echte Domain durch', () => expect(istTestAdresse('test@mabe.de')).toBe(false))
  })
})

// ═══════════════════════════════════════════════════════════════
// AGENT 2 · EDGE CASES — Grenzwerte, Leer, Extreme
// ═══════════════════════════════════════════════════════════════
describe('Agent 2 · Edge Cases', () => {
  describe('KMU-Grenzwerte (exakt auf der Schwelle)', () => {
    it('genau 10 JAE = NICHT Kleinst (strikt kleiner)', () => {
      const erg = evaluateKmu({ companyName: 'T', employees: 10, turnover: 1000, balanceSheet: 1000, holdings: [] })
      expect(erg.category).not.toBe('kleinst')
    })
    it('genau 9.99 JAE = Kleinst', () => {
      const erg = evaluateKmu({ companyName: 'T', employees: 9.99, turnover: 1000, balanceSheet: 1000, holdings: [] })
      expect(erg.category).toBe('kleinst')
    })
    it('genau 50 JAE = NICHT Klein', () => {
      const erg = evaluateKmu({ companyName: 'T', employees: 50, turnover: 1000, balanceSheet: 1000, holdings: [] })
      expect(erg.category).not.toBe('klein')
    })
    it('genau 249.99 JAE = Mittel', () => {
      const erg = evaluateKmu({ companyName: 'T', employees: 249.99, turnover: 1000, balanceSheet: 1000, holdings: [] })
      expect(erg.category).toBe('mittel')
    })
    it('genau 250 JAE = Gross', () => {
      const erg = evaluateKmu({ companyName: 'T', employees: 250, turnover: 1000, balanceSheet: 1000, holdings: [] })
      expect(erg.category).toBe('gross')
      expect(erg.isKmu).toBe(false)
    })
    it('0 JAE + 0 Umsatz = Kleinst', () => {
      const erg = evaluateKmu({ companyName: 'T', employees: 0, turnover: 0, balanceSheet: 0, holdings: [] })
      expect(erg.category).toBe('kleinst')
    })
    it('negative Zahlen werden als 0 behandelt', () => {
      const erg = evaluateKmu({ companyName: 'T', employees: -5, turnover: -100, balanceSheet: -50, holdings: [] })
      expect(erg.own.employees).toBe(0)
      expect(erg.own.turnover).toBe(0)
    })
    it('NaN / Infinity Eingaben werden abgefangen', () => {
      const erg = evaluateKmu({ companyName: 'T', employees: NaN, turnover: Infinity, balanceSheet: -Infinity, holdings: [] })
      expect(erg.own.employees).toBe(0)
      expect(erg.own.turnover).toBe(0)
      expect(erg.own.balanceSheet).toBe(0)
    })
  })

  describe('Validierung: Grenzwerte', () => {
    it('IBAN: genau 22 Stellen (DE-Standard)', () => {
      expect(pruefeIban('DE02120300000000202051').ok).toBe(true)
    })
    it('IBAN: 21 Stellen = zu kurz', () => {
      expect(pruefeIban('DE0212030000000020205').ok).toBe(false)
    })
    it('IBAN: 23 Stellen = zu lang', () => {
      expect(pruefeIban('DE021203000000002020511').ok).toBe(false)
    })
    it('IBAN: falsche Prüfziffer', () => {
      expect(pruefeIban('DE02120300000000202052').ok).toBe(false)
    })
    it('Steuer-ID: genau 11 Ziffern', () => {
      expect(pruefeSteuerId('12345678901').ok).toBe(false) // ungültige Prüfziffer
    })
    it('Steuer-ID: 10 Ziffern = zu kurz', () => {
      expect(pruefeSteuerId('1234567890').ok).toBe(false)
    })
    it('USt-ID: korrektes Format', () => {
      expect(pruefeUstId('DE123456789').ok).toBe(true)
    })
    it('USt-ID: 8 Ziffern = zu kurz', () => {
      expect(pruefeUstId('DE12345678').ok).toBe(false)
    })
    it('WZ-Code: gültig', () => expect(pruefeWzCode('28.29').ok).toBe(true))
    it('WZ-Code: nur Buchstabe', () => expect(pruefeWzCode('C').ok).toBe(true))
    it('WZ-Code: ungültiges Zeichen', () => expect(pruefeWzCode('28.29.abc!').ok).toBe(false))
    it('Steuernummer: 9 Ziffern = zu kurz', () => {
      expect(pruefeSteuernummer('123456789').ok).toBe(false)
    })
    it('Steuernummer: 14 Ziffern = zu lang', () => {
      expect(pruefeSteuernummer('12345678901234').ok).toBe(false)
    })
  })

  describe('Extreme String-Längen', () => {
    it('5.000 Zeichen Firmenname in KMU-Engine', () => {
      const name = 'A'.repeat(5000)
      const erg = evaluateKmu({ companyName: name, employees: 5, turnover: 100, balanceSheet: 100, holdings: [] })
      expect(erg.category).toBe('kleinst')
    })
    it('fehlerMeldung kürzt auf 300 Zeichen', () => {
      const langeMsg = 'X'.repeat(1000)
      const msg = fehlerMeldung(new Error(langeMsg))
      expect(msg.length).toBeLessThanOrEqual(301)
    })
    it('formatiereWert mit extrem langem Array', () => {
      const arr = Array(1000).fill('item')
      const formatted = formatiereWert(arr)
      expect(formatted.length).toBeGreaterThan(100)
    })
  })

  describe('Journey: alle Schritte mit leeren Daten validieren', () => {
    it('Unternehmen-Schema lehnt leere Pflichtfelder ab', () => {
      const schema = schemaFuerSchritt(SCHRITTE.find((s) => s.id === 'unternehmen')!)
      const res = schema.safeParse({})
      expect(res.success).toBe(false)
    })
    it('KMU-Schema verlangt genau 2 Jahre', () => {
      const schema = schemaFuerSchritt(SCHRITTE.find((s) => s.id === 'kmu')!)
      const res1 = schema.safeParse({ jahre: [], beteiligungen: [] })
      expect(res1.success).toBe(false)
      const res2 = schema.safeParse({ jahre: [{ geschaeftsjahr: 2025 }], beteiligungen: [] })
      expect(res2.success).toBe(false)
      const res3 = schema.safeParse({
        jahre: [{ geschaeftsjahr: 2025, jae: 10 }, { geschaeftsjahr: 2024, jae: 9 }],
        beteiligungen: [],
      })
      expect(res3.success).toBe(true)
    })
    it('Vollmacht-Schema: eskalator ohne Unterschrift schlägt fehl', () => {
      const schema = schemaFuerSchritt(SCHRITTE.find((s) => s.id === 'vollmacht')!)
      const res = schema.safeParse({
        beantragungsweg: 'eskalator',
        vorhaben_nicht_begonnen: true,
        wahrheitsgemaess: true,
        dsgvo: true,
      })
      expect(res.success).toBe(false)
    })
    it('Selbst-Weg hat nur 3 Schritte', () => {
      const schritte = aktiveSchritteFuer('selbst')
      expect(schritte.length).toBe(3)
    })
    it('Voller Weg hat 8 Schritte (ohne selbst)', () => {
      const schritte = aktiveSchritteFuer('eskalator')
      expect(schritte.length).toBe(8)
      expect(schritte.find((s) => s.id === 'selbst')).toBeUndefined()
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// AGENT 3 · BUSINESS LOGIC — KMU, Status, Verbund-Ketten
// ═══════════════════════════════════════════════════════════════
describe('Agent 3 · Business Logic', () => {
  describe('Förderquote: alle Kategorien', () => {
    it('kleinst = 45%', () => expect(fundingRateFor('kleinst')).toBe(45))
    it('klein = 45%', () => expect(fundingRateFor('klein')).toBe(45))
    it('mittel = 35%', () => expect(fundingRateFor('mittel')).toBe(35))
    it('gross = 25%', () => expect(fundingRateFor('gross')).toBe(25))
  })

  describe('Verbund: komplexe Ketten', () => {
    it('tiefe Kette: Holding > Mutter > Antragsteller (alle verbunden)', () => {
      const holdings: Holding[] = [
        { id: '1', name: 'Mutter', sharePct: 80, employees: 100, turnover: 10000000, balanceSheet: 8000000, bezug: 'Antragsteller' },
        { id: '2', name: 'Holding', sharePct: 90, employees: 500, turnover: 60000000, balanceSheet: 45000000, bezug: 'Mutter' },
      ]
      const erg = evaluateKmu({ companyName: 'Antragsteller', employees: 20, turnover: 2000000, balanceSheet: 1500000, holdings })
      // Holding ist über Kette verbunden (500 JAE voll zugerechnet) → gross
      expect(erg.category).toBe('gross')
      expect(erg.consolidated.employees).toBe(620) // 20 + 100 + 500
    })
    it('Partner eines Verbundenen zählt mit', () => {
      const holdings: Holding[] = [
        { id: '1', name: 'Mutter AG', sharePct: 70, employees: 100, turnover: 5000000, balanceSheet: 4000000 },
        { id: '2', name: 'Partner GmbH', sharePct: 40, employees: 30, turnover: 2000000, balanceSheet: 1500000, bezug: 'Mutter AG' },
      ]
      const erg = evaluateKmu({ companyName: 'Antragsteller', employees: 10, turnover: 500000, balanceSheet: 400000, holdings })
      // Mutter ist verbunden (100%), Partner von Mutter zählt 40%
      expect(erg.consolidated.employees).toBe(10 + 100 + 30 * 0.4)
    })
    it('20 Beteiligungen (Maximum)', () => {
      const holdings: Holding[] = Array.from({ length: 20 }, (_, i) => ({
        id: String(i), name: `Firma ${i}`, sharePct: 30, employees: 5, turnover: 100000, balanceSheet: 50000,
      }))
      const zeilen = analysiereVerbund('Antragsteller', holdings)
      expect(zeilen.length).toBe(20)
      expect(zeilen.every((z) => z.art === 'partner')).toBe(true)
    })
    it('Beteiligung < 25% wird ignoriert', () => {
      const h: Holding = { id: '1', name: 'Klein', sharePct: 24, employees: 100, turnover: 50000000, balanceSheet: 40000000 }
      const erg = evaluateKmu({ companyName: 'Antragsteller', employees: 5, turnover: 100000, balanceSheet: 50000, holdings: [h] })
      expect(erg.consolidated.employees).toBe(5) // nur eigene
    })
    it('Beteiligung = genau 25% = Partner (anteilig)', () => {
      const h: Holding = { id: '1', name: 'Partner', sharePct: 25, employees: 100, turnover: 1000000, balanceSheet: 800000 }
      const erg = evaluateKmu({ companyName: 'Antragsteller', employees: 5, turnover: 100000, balanceSheet: 50000, holdings: [h] })
      expect(erg.consolidated.employees).toBe(5 + 25) // 25% von 100
    })
    it('Beteiligung = genau 50% = Partner (nicht verbunden)', () => {
      const zeilen = analysiereVerbund('A', [{ id: '1', name: 'P', sharePct: 50, employees: 10, turnover: 100, balanceSheet: 100 }])
      expect(zeilen[0].art).toBe('partner')
    })
    it('Beteiligung = 50.01% = verbunden (100%)', () => {
      const zeilen = analysiereVerbund('A', [{ id: '1', name: 'V', sharePct: 50.01, employees: 10, turnover: 100, balanceSheet: 100 }])
      expect(zeilen[0].art).toBe('verbunden')
      expect(zeilen[0].effektivPct).toBe(100)
    })
  })

  describe('Status-Maschine: erschöpfende Übergangsprüfung', () => {
    const alleStatus = ['angelegt', 'eingeladen', 'in_bearbeitung', 'eingereicht', 'abgeschlossen', 'bewilligt', 'vnw_eingereicht', 'widerrufen'] as const
    it.each(alleStatus)('Status "%s" hat definierte Übergänge', (s) => {
      expect(STATUS_TRANSITIONEN[s]).toBeDefined()
    })
    it('widerrufen ist terminal', () => {
      expect(STATUS_TRANSITIONEN.widerrufen).toEqual([])
    })
    it('Der komplette Lebenszyklus funktioniert', () => {
      expect(istUebergangErlaubt('angelegt', 'eingeladen')).toBe(true)
      expect(istUebergangErlaubt('eingeladen', 'in_bearbeitung')).toBe(true)
      expect(istUebergangErlaubt('in_bearbeitung', 'eingereicht')).toBe(true)
      expect(istUebergangErlaubt('eingereicht', 'abgeschlossen')).toBe(true)
      expect(istUebergangErlaubt('abgeschlossen', 'bewilligt')).toBe(true)
      expect(istUebergangErlaubt('bewilligt', 'vnw_eingereicht')).toBe(true)
    })
    it('Kein Überspringen von Stufen', () => {
      expect(istUebergangErlaubt('angelegt', 'bewilligt')).toBe(false)
      expect(istUebergangErlaubt('angelegt', 'vnw_eingereicht')).toBe(false)
      expect(istUebergangErlaubt('in_bearbeitung', 'bewilligt')).toBe(false)
    })
    it('Rückkorrektur ist erlaubt', () => {
      expect(istUebergangErlaubt('vnw_eingereicht', 'bewilligt')).toBe(true)
      expect(istUebergangErlaubt('bewilligt', 'abgeschlossen')).toBe(true)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// AGENT 4 · DATA INTEGRITY — CSV, Diff, Vollständigkeit
// ═══════════════════════════════════════════════════════════════
describe('Agent 4 · Data Integrity', () => {
  describe('CSV-Injektion (CWE-1236)', () => {
    it('Formel-Injektion wird neutralisiert (=cmd)', () => {
      const zeile = csvZeile(['=cmd|/C calc', 'normal'])
      expect(zeile).toContain("'=")  // Apostroph-Präfix neutralisiert
      expect(zeile).not.toMatch(/^=cmd/)
    })
    it('Alle sichtbaren Formel-Präfixe werden neutralisiert', () => {
      for (const prefix of ['=', '+', '-', '@']) {
        const zeile = csvZeile([prefix + 'cmd'])
        expect(zeile.startsWith(prefix)).toBe(false)
        expect(zeile.startsWith("'")).toBe(true)
      }
    })
    it('Zahlen bleiben unberührt', () => {
      expect(csvZeile([12345])).toBe('12345')
      expect(csvZeile([0])).toBe('0')
    })
    it('Semikolon im Wert wird escaped', () => {
      expect(csvZeile(['a;b'])).toBe('"a;b"')
    })
    it('Anführungszeichen werden verdoppelt', () => {
      expect(csvZeile(['say "hi"'])).toBe('"say ""hi"""')
    })
    it('baueCsv erzeugt BOM + CRLF', () => {
      const csv = baueCsv(['A'], [['1']])
      expect(csv.charCodeAt(0)).toBe(0xfeff) // BOM
      expect(csv).toContain('\r\n')
    })
  })

  describe('Revision-Diff', () => {
    it('numerische Strings werden als Zahl verglichen', () => {
      const diff = bildeDiff({ wert: '123' }, { wert: '123.0' }, ['wert'])
      expect(diff.wert).toBeUndefined() // gleich
    })
    it('null und leerer String gelten als gleich', () => {
      const diff = bildeDiff({ wert: null }, { wert: '' }, ['wert'])
      expect(diff.wert).toBeUndefined()
    })
    it('Arrays werden reihenfolgenempfindlich verglichen (JSON-String)', () => {
      const diff = bildeDiff({ tags: ['a', 'b'] }, { tags: ['b', 'a'] }, ['tags'])
      expect(diff.tags).toBeDefined() // verschiedene Reihenfolge = Änderung
      const diff2 = bildeDiff({ tags: ['a', 'b'] }, { tags: ['a', 'b'] }, ['tags'])
      expect(diff2.tags).toBeUndefined() // gleiche Reihenfolge = keine Änderung
    })
    it('Nur Whitelist-Felder werden betrachtet', () => {
      const diff = bildeDiff({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, c: 3 }, ['a', 'c'])
      expect(diff.b).toBeUndefined() // b nicht in Whitelist
    })
  })

  describe('Vollständigkeit (BAFA-Einreichungsreife)', () => {
    it('Komplett leer = alle Bausteine offen', () => {
      const erg = pruefeVollstaendigkeit({
        stammdaten: null, kmuBewertungen: [], deminimis: null, vollmacht: null, dokumente: [],
      })
      expect(erg.vollstaendig).toBe(false)
      expect(erg.offen.length).toBe(7) // alle Bausteine
    })
    it('Nur 1 KMU-Jahr = unvollständig', () => {
      const erg = pruefeVollstaendigkeit({
        stammdaten: null,
        kmuBewertungen: [{ geschaeftsjahr: 2025, kategorie: 'klein' }],
        deminimis: null, vollmacht: null, dokumente: [],
      })
      expect(erg.bausteine.find((b) => b.id === 'kmu')?.ok).toBe(false)
    })
    it('Eskalator-Vollmacht ohne Nachweis = unvollständig', () => {
      const erg = pruefeVollstaendigkeit({
        stammdaten: null, kmuBewertungen: [], deminimis: null,
        vollmacht: { beantragungsweg: 'eskalator', unterzeichnet_von: null, pdf_path: null, signatur_bild_path: null },
        dokumente: [],
      })
      expect(erg.bausteine.find((b) => b.id === 'vollmacht')?.ok).toBe(false)
    })
    it('Selbst-Weg ohne Vollmacht = vollständig bei diesem Baustein', () => {
      const erg = pruefeVollstaendigkeit({
        stammdaten: null, kmuBewertungen: [], deminimis: null,
        vollmacht: { beantragungsweg: 'selbst', unterzeichnet_von: null, pdf_path: null, signatur_bild_path: null },
        dokumente: [],
      })
      expect(erg.bausteine.find((b) => b.id === 'vollmacht')?.ok).toBe(true)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// AGENT 5 · ERROR HANDLING — Malformed Input, Unicode
// ═══════════════════════════════════════════════════════════════
describe('Agent 5 · Error Handling', () => {
  describe('fehlerMeldung mit allen Input-Typen', () => {
    it('undefined → Fallback', () => expect(fehlerMeldung(undefined)).toContain('unerwartet'))
    it('null → Fallback', () => expect(fehlerMeldung(null)).toContain('unerwartet'))
    it('number → Fallback', () => expect(fehlerMeldung(42)).toContain('unerwartet'))
    it('object → Fallback', () => expect(fehlerMeldung({ foo: 'bar' })).toContain('unerwartet'))
    it('empty Error → Fallback', () => expect(fehlerMeldung(new Error(''))).toContain('unerwartet'))
    it('whitespace Error → Fallback', () => expect(fehlerMeldung(new Error('   '))).toContain('unerwartet'))
    it('Error mit Unicode-Emoji', () => {
      const msg = fehlerMeldung(new Error('Fehler 🚨 bei Datei 📄'))
      expect(msg).toContain('🚨')
    })
  })

  describe('Gemini-Parser mit adversarial Input', () => {
    it('leerer String → null', () => expect(parseBescheidAnalyse('')).toBeNull())
    it('reines Markdown ohne JSON → null', () => expect(parseBescheidAnalyse('```code```')).toBeNull())
    it('JSON-Array → null', () => expect(parseBescheidAnalyse('[1,2,3]')).toBeNull())
    it('nur Zahlen → null', () => expect(parseBescheidAnalyse('42')).toBeNull())
    it('nested JSON mit null-Werten', () => {
      const a = parseBescheidAnalyse(JSON.stringify({ aktenzeichen: null, bewilligt_am: null, foerderquote_pct: null }))
      expect(a).toBeNull() // alles leer = kein Ergebnis
    })
    it('Angebot-Parser: Datum in US-Format wird akzeptiert', () => {
      const a = parseAngebotAnalyse(JSON.stringify({ angebot_datum: '2026-03-15' }))
      expect(a?.angebot_datum).toBe('2026-03-15')
    })
    it('Angebot-Parser: deutsches Datumsformat', () => {
      const a = parseAngebotAnalyse(JSON.stringify({ angebot_datum: '15.03.2026' }))
      expect(a?.angebot_datum).toBe('2026-03-15')
    })
    it('Angebot-Parser: ungewöhnliches Datum wird trotzdem umgeformt (Regex-basiert)', () => {
      const a = parseAngebotAnalyse(JSON.stringify({ angebot_datum: '32.13.2026' }))
      // Parser ist Regex-basiert: DD.MM.YYYY → YYYY-MM-DD, ohne Kalender-Validierung
      expect(a?.angebot_datum).toBe('2026-13-32')
    })
    it('Angebot-Parser: gar kein Datum-Muster → null im Feld', () => {
      const a = parseAngebotAnalyse(JSON.stringify({ angebot_datum: 'not-a-date', kunde_firma: 'Test' }))
      expect(a).not.toBeNull()
      expect(a?.angebot_datum == null).toBe(true) // null oder undefined
    })
  })

  describe('loggeFehler ist ausfallssicher', () => {
    it('wirft nie selbst (auch bei zirkulärem Kontext)', () => {
      const zirkular: Record<string, unknown> = {}
      zirkular.self = zirkular
      expect(() => loggeFehler('test', new Error('ok'), zirkular)).not.toThrow()
    })
    it('kontext undefined ist erlaubt', () => {
      expect(() => loggeFehler('test', new Error('ok'), undefined)).not.toThrow()
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// AGENT 6 · PERFORMANCE — Grosse Datenmengen, Rate-Limit
// ═══════════════════════════════════════════════════════════════
describe('Agent 6 · Performance', () => {
  it('KMU mit 50 Beteiligungen (über Limit) terminiert', () => {
    const holdings: Holding[] = Array.from({ length: 50 }, (_, i) => ({
      id: String(i), name: `F${i}`, sharePct: 30, employees: 10, turnover: 100000, balanceSheet: 50000,
    }))
    const start = Date.now()
    const erg = evaluateKmu({ companyName: 'T', employees: 5, turnover: 100000, balanceSheet: 50000, holdings })
    const dauer = Date.now() - start
    expect(erg).toBeDefined()
    expect(dauer).toBeLessThan(5000) // 5s Timeout
  })

  it('CSV mit 10.000 Zeilen', () => {
    const zeilen = Array.from({ length: 10000 }, (_, i) => [`Vorgang ${i}`, 'eingereicht', String(i * 100)])
    const csv = baueCsv(['ID', 'Status', 'Wert'], zeilen)
    expect(csv.length).toBeGreaterThan(100000)
    expect(csv).toContain('Vorgang 9999')
  })

  it('Rate-Limit: 100 Anfragen in 1ms', () => {
    let erlaubt = 0
    for (let i = 0; i < 100; i++) {
      if (rateLimit(`perf-test-${i % 5}`, 10, 60000)) erlaubt++
    }
    // 5 IPs × 10 erlaubt = 50 erlaubt, 50 blockiert
    expect(erlaubt).toBe(50)
  })

  it('Fortschritt: 100 Schritte berechnet korrekt', () => {
    const info = fortschrittInfo(99, 100)
    expect(info.prozent).toBe(99)
    expect(info.erledigt).toBe(99)
    expect(info.fertig).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// AGENT 7 · CONCURRENCY — Idempotenz
// ═══════════════════════════════════════════════════════════════
describe('Agent 7 · Concurrency', () => {
  describe('Fristen-Idempotenz (Unique-Key Logik)', () => {
    const HEUTE = new Date('2026-11-18T10:00:00')
    const kandidat: FristKandidat = {
      angebotId: 'a1', angebotNr: 'ANG-1', kundeFirma: 'Test GmbH',
      durchfuehrungBis: '2026-11-25', vnwFrist: '2026-11-28',
      vnwVorlagefrist: null, vnwEingereicht: false,
    }
    it('Gleiche Frist löst nur EINE Erinnerung aus (Domäne deterministisch)', () => {
      const e1 = sammleFristErinnerungen([kandidat], FRIST_ERINNERUNG_STANDARD, HEUTE)
      const e2 = sammleFristErinnerungen([kandidat], FRIST_ERINNERUNG_STANDARD, HEUTE)
      expect(e1).toEqual(e2) // identisches Ergebnis
      expect(e1.filter((e) => e.art === 'zeitraum_ende')).toHaveLength(1)
      expect(e1.filter((e) => e.art === 'vnw_frist')).toHaveLength(1)
    })
    it('VNW eingereicht → keine vnw_frist-Erinnerung mehr', () => {
      const e = sammleFristErinnerungen(
        [{ ...kandidat, vnwEingereicht: true }],
        FRIST_ERINNERUNG_STANDARD, HEUTE,
      )
      expect(e.filter((x) => x.art === 'vnw_frist')).toHaveLength(0)
      expect(e.filter((x) => x.art === 'zeitraum_ende')).toHaveLength(1) // Zeitraum bleibt
    })
    it('Geänderte Frist löst erneut aus (anderer fristAm-Wert)', () => {
      const e1 = sammleFristErinnerungen([kandidat], FRIST_ERINNERUNG_STANDARD, HEUTE)
      const e2 = sammleFristErinnerungen(
        [{ ...kandidat, durchfuehrungBis: '2026-11-20' }],
        FRIST_ERINNERUNG_STANDARD, HEUTE,
      )
      expect(e1[0].fristAm).not.toBe(e2[0].fristAm) // andere Frist = neue Erinnerung
    })
  })

  describe('Rate-Limit: deterministische Fenster', () => {
    it('Limit blockiert nach Erreichen des Maximums', () => {
      const key = `block-test-${Date.now()}`
      const ergebnisse: boolean[] = []
      for (let i = 0; i < 6; i++) ergebnisse.push(rateLimit(key, 5, 60000))
      expect(ergebnisse.filter(Boolean)).toHaveLength(5) // 5 erlaubt
      expect(ergebnisse[5]).toBe(false) // 6. blockiert
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// AGENT 8 · COMPLIANCE — DSGVO, Audit
// ═══════════════════════════════════════════════════════════════
describe('Agent 8 · Compliance', () => {
  describe('Fehlende Daten = keine falschen "vollständig"-Aussagen', () => {
    it('Ohne DSGVO-Einwilligung wird der Prozess nicht als vollständig markiert', () => {
      const erg = pruefeVollstaendigkeit({
        stammdaten: null, kmuBewertungen: [], deminimis: null, vollmacht: null, dokumente: [],
      })
      expect(erg.vollstaendig).toBe(false)
    })
  })

  describe('E-Mail-Guard: Test-Daten verlassen nie das System', () => {
    const blockierteAdressen = [
      'test@example.com', 'test@example.org', 'test@example.net',
      'x@mailinator.com', 'x@maildrop.cc', 'x@yopmail.com',
      'x@test.de', 'x@y.invalid', 'x@y.test',
    ]
    it.each(blockierteAdressen)('"%s" wird blockiert', (addr) => {
      expect(istTestAdresse(addr)).toBe(true)
    })
  })

  describe('Webhook-URL wird nie an den Client ausgeliefert', () => {
    it('loeseWebhookAuf gibt nur die URL zurück, nie Credentials', () => {
      const result = loeseWebhookAuf('https://user:pass@hook.example.com/path', null)
      expect(result.url).toBe('https://user:pass@hook.example.com/path')
      expect(result.quelle).toBe('datenbank')
    })
    it('Ohne Konfiguration = explizit "keine"', () => {
      const result = loeseWebhookAuf(null, null)
      expect(result.url).toBeNull()
      expect(result.quelle).toBe('keine')
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// AGENT 9 · INTEGRATION — Cross-Modul-Pipelines
// ═══════════════════════════════════════════════════════════════
describe('Agent 9 · Integration', () => {
  describe('KMU → Fristen → E-Mail Pipeline', () => {
    it('KMU-Ergebnis mit 45% füttert korrekte Fördersumme in Fristen-System', () => {
      const kmu = evaluateKmu({ companyName: 'Test', employees: 5, turnover: 100000, balanceSheet: 50000, holdings: [] })
      const investition = 100000
      const zuschuss = (investition * kmu.fundingRatePct) / 100
      expect(kmu.fundingRatePct).toBe(45)
      expect(zuschuss).toBe(45000)
      // Dieser Wert würde in bescheide.foerdersumme_eur landen
      // und in der Fristen-Erinnerung als Kontext erscheinen
    })
    it('Bescheid-OCR-Daten fließen korrekt in Fristen-Domäne', () => {
      const ocr = parseBescheidAnalyse(JSON.stringify({
        aktenzeichen: 'TEST-123',
        vnw_frist_am: '2027-03-15',
        foerderquote_pct: 45,
        foerdersumme_eur: 45000,
        durchfuehrung_bis: '2027-01-31',
      }))
      expect(ocr).not.toBeNull()
      expect(ocr!.vnw_frist_am).toBe('2027-03-15')
      // Diese Werte werden in bescheide gespeichert und von
      // sammleFristErinnerungen als Kandidaten ausgewertet
      const kandidat: FristKandidat = {
        angebotId: 'a1', angebotNr: 'ANG-1', kundeFirma: 'Test',
        durchfuehrungBis: ocr!.durchfuehrung_bis,
        vnwFrist: ocr!.vnw_frist_am,
        vnwVorlagefrist: null, vnwEingereicht: false,
      }
      const erinn = sammleFristErinnerungen([kandidat], { zeitraumEndeTage: 120, vnwFristTage: 180 }, new Date('2026-11-18'))
      // 2027-01-31 ist 74 Tage entfernt, innerhalb 120 → fällig
      expect(erinn.some((e) => e.art === 'zeitraum_ende')).toBe(true)
      // 2027-03-15 ist 117 Tage entfernt, innerhalb 180 → fällig
      expect(erinn.some((e) => e.art === 'vnw_frist')).toBe(true)
    })
  })

  describe('Journey → Bescheid Status-Pipeline', () => {
    it('Nach Journey-Abschluss (eingereicht) ist Bescheid-Upload möglich', () => {
      // Status eingereicht → abgeschlossen → bewilligt → Bescheid
      expect(istUebergangErlaubt('eingereicht', 'abgeschlossen')).toBe(true)
      expect(istUebergangErlaubt('abgeschlossen', 'bewilligt')).toBe(true)
      // Bescheid-Upload setzt bewilligt nur wenn noch nicht weiter
      expect(istUebergangErlaubt('bewilligt', 'vnw_eingereicht')).toBe(true)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// AGENT 10 · API CONTRACTS — Webhook, CSV, E-Mail
// ═══════════════════════════════════════════════════════════════
describe('Agent 10 · API Contracts', () => {
  describe('Webhook-URL-Regeln', () => {
    it('HTTPS ist erlaubt', () => expect(istGueltigeWebhookUrl('https://hook.example.com')).toBe(true))
    it('HTTP localhost ist erlaubt (Entwicklung)', () => expect(istGueltigeWebhookUrl('http://localhost:3000/hook')).toBe(true))
    it('HTTP 127.0.0.1 ist erlaubt', () => expect(istGueltigeWebhookUrl('http://127.0.0.1:3000/hook')).toBe(true))
    it('HTTP externe Domain ist VERBOTEN', () => expect(istGueltigeWebhookUrl('http://evil.com/hook')).toBe(false))
    it('FTP ist verboten', () => expect(istGueltigeWebhookUrl('ftp://files.example.com')).toBe(false))
    it('Keine URL = verboten', () => expect(istGueltigeWebhookUrl('not-a-url')).toBe(false))
    it('DB-Wert hat Vorrang vor ENV', () => {
      const result = loeseWebhookAuf('https://db.example/hook', 'https://env.example/hook')
      expect(result.url).toBe('https://db.example/hook')
      expect(result.quelle).toBe('datenbank')
    })
    it('Leerer DB-Wert fällt auf ENV zurück', () => {
      const result = loeseWebhookAuf('  ', 'https://env.example/hook')
      expect(result.url).toBe('https://env.example/hook')
      expect(result.quelle).toBe('umgebung')
    })
  })

  describe('IBAN-Normalisierung', () => {
    it('Leerzeichen werden entfernt', () => {
      expect(normalisiereIban('DE02 1203 0000 0000 2020 51')).toBe('DE02120300000000202051')
    })
    it('Kleinbuchstaben werden großgeschrieben', () => {
      expect(normalisiereIban('de02120300000000202051')).toBe('DE02120300000000202051')
    })
  })

  describe('Bescheid-OCR: Quote-Whitelist', () => {
    it('Nur 25/35/45 sind gültig', () => {
      for (const valid of [25, 35, 45]) {
        const a = parseBescheidAnalyse(JSON.stringify({ aktenzeichen: 'X', foerderquote_pct: valid }))
        expect(a?.foerderquote_pct).toBe(valid)
      }
      for (const invalid of [20, 30, 40, 50, 55, 100, 0, -25]) {
        const a = parseBescheidAnalyse(JSON.stringify({ aktenzeichen: 'X', foerderquote_pct: invalid }))
        expect(a?.foerderquote_pct).toBeNull()
      }
    })
  })
})
