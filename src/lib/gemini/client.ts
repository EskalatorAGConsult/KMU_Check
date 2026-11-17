import 'server-only'

import { env } from '@/env'

/**
 * Generischer Gemini-REST-Client (server-only): sendet ein PDF multimodal
 * (inline_data base64) an generateContent und erzwingt JSON-Antwort.
 * Wiederverwendbar für alle Dokument-Analysen (Angebots-PDF, Zuwendungs-
 * bescheid, spaeter ggf. weitere) – Modell/Endpoint zentral gepflegt.
 *
 * API: generativelanguage.googleapis.com, Modell gemini-3.6-flash
 * (live gegen /v1beta/models verifiziert, Stand 2026-09). Key aus
 * GEMINI_API_KEY (nie an den Client). Fehler -> konkreter Grund.
 */

const MODELL = 'gemini-3.6-flash'
const ENDPUNKT = `https://generativelanguage.googleapis.com/v1beta/models/${MODELL}:generateContent`
const MAX_PDF_BYTES = 15 * 1024 * 1024 // 15 MB inline-Limit weit unter API-Grenze

export type GeminiTextErgebnis =
  | { ok: true; text: string }
  | { ok: false; fehler: string }

/** Sendet Prompt + PDF an Gemini und liefert die Rohtext-Antwort (JSON-String). */
export async function frageGeminiMitPdf(prompt: string, pdf: Uint8Array): Promise<GeminiTextErgebnis> {
  const key = env.GEMINI_API_KEY
  if (!key) return { ok: false, fehler: 'GEMINI_API_KEY ist nicht gesetzt (lokal in .env.local bzw. in Vercel).' }
  if (pdf.length > MAX_PDF_BYTES) {
    return { ok: false, fehler: `PDF zu groß (${Math.round(pdf.length / 1024 / 1024)} MB, max. 15 MB).` }
  }
  try {
    const res = await fetch(ENDPUNKT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: Buffer.from(pdf).toString('base64') } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300)
      console.error(`[gemini] generateContent -> HTTP ${res.status}: ${detail}`)
      return { ok: false, fehler: `Gemini-API meldet HTTP ${res.status}${detail ? `: ${detail}` : ''}` }
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    // Leere Antwort gilt als transport-ok: die Aufrufer melden fachlich
    // („keine … erkannt"), weil nur sie wissen, was fehlt.
    return { ok: true, text }
  } catch (e) {
    console.error('[gemini] Analyse fehlgeschlagen:', e)
    return {
      ok: false,
      fehler: `Netzwerk-/Timeout-Fehler bei der Gemini-API (${e instanceof Error ? e.message : String(e)}).`,
    }
  }
}
