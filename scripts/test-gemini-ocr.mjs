// Wegwerf-Testskript: erzeugt ein Muster-Angebot als PDF und schickt es
// an die Gemini-API (gleicher Aufruf wie src/lib/gemini/angebot-analyse.ts).
// Ausführen: node scripts/test-gemini-ocr.mjs
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const key = env
  .split('\n')
  .find((l) => l.startsWith('GEMINI_API_KEY='))
  ?.split('=')[1]
  ?.replace(/["'\r]/g, '')
if (!key) throw new Error('GEMINI_API_KEY fehlt')

const pdf = await PDFDocument.create()
const page = pdf.addPage([595, 842])
const font = await page.doc.embedFont(StandardFonts.Helvetica)
const zeilen = [
  'MABE Maschinen- und Behaelterbau GmbH - Angebot Nr. AN-2026-0142',
  'Datum: 12.03.2026',
  '',
  'An: Musterbau GmbH, Herrn Max Mustermann',
  'Industriestrasse 14, 45468 Muelheim an der Ruhr',
  'E-Mail: einkauf@musterbau.de, USt-IdNr.: DE123456789',
  '',
  'MABE smart control - MSR-Technik nach BAFA EEW Modul 3',
  'Energiemanagement-Software: 18.500,00 EUR',
  'Mess- und Sensortechnik (42 Sensoren, davon 30 mit Prozessbezug): 26.750,50 EUR',
  'Steuerungs- und Regelungstechnik: 9.900,00 EUR',
  'Voraussichtliches Projektende: 30.09.2026',
]
zeilen.forEach((z, i) => page.drawText(z, { x: 50, y: 800 - i * 20, size: 11, font }))
const pdfBytes = await pdf.save()
console.log('Test-PDF erzeugt, Bytes:', pdfBytes.length)

const prompt = `Analysiere dieses Angebot und gib NUR ein JSON-Objekt zurueck mit den Feldern:
kunde_firma, kunde_ansprechpartner, kunde_email, strasse, plz, ort, ust_id, angebot_nr, angebot_datum,
invest_software, invest_messtechnik, invest_steuerung, sensoren_gesamt, sensoren_prozessbezug, projektende.
Beträge als Zahl, Datum als YYYY-MM-DD. Fehlende Felder: null.`

const antwort = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'application/pdf', data: Buffer.from(pdfBytes).toString('base64') } }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  }),
})
console.log('HTTP-Status:', antwort.status)
const json = await antwort.json()
if (!antwort.ok) {
  console.log('Fehler:', JSON.stringify(json).slice(0, 600))
  process.exit(1)
}
const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
console.log('Gemini-Rohantwort:', text)
