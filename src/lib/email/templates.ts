import 'server-only'

/**
 * HTML-E-Mail-Templates in MABE-CI (Navy #0b2239 / Türkis #0d9488, White-Mode).
 * Tabellenbasiert + inline Styles fuer maximale Mail-Client-Kompatibilitaet.
 * Texte: Deutsch, klare Handlungsaufforderung, kein Fachjargon.
 */

const NAVY = '#0b2239'
const TEAL = '#0d9488'
const OLIVE = '#5b6570'
const BG = '#f4f6f8'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Basis-Layout: Kopf mit Wortmarke, Inhalt, Fuss mit Impressum-Hinweis. */
export function layout(titel: string, inhalt: string): string {
  return `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titel)}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:${NAVY};border-radius:16px 16px 0 0;padding:20px 28px;">
      <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">MABE</span>
      <span style="color:${TEAL};font-size:11px;font-weight:600;letter-spacing:2px;display:block;margin-top:2px;">SMART CONTROL · FÖRDERPORTAL</span>
    </div>
    <div style="background:#ffffff;padding:32px 28px;border-radius:0 0 16px 16px;border:1px solid #e5e9ee;border-top:none;">
      ${inhalt}
    </div>
    <p style="color:${OLIVE};font-size:11px;line-height:1.6;text-align:center;padding:20px 12px 0;">
      MABE Maschinen- und Behälterbau GmbH · Förderportal BAFA Modul 3<br>
      Diese E-Mail wurde automatisch erzeugt – bei Fragen antworten Sie einfach auf diese Mail oder wenden Sie sich an Ihren MABE-Ansprechpartner.
    </p>
  </div>
</body>
</html>`
}

export function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${TEAL};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:12px;margin:8px 0;">${esc(label)}</a>`
}

export function h1(text: string): string {
  return `<h1 style="color:${NAVY};font-size:22px;line-height:1.3;margin:0 0 16px;">${esc(text)}</h1>`
}

export function p(text: string): string {
  return `<p style="color:#33404d;font-size:15px;line-height:1.65;margin:0 0 14px;">${text}</p>`
}

export function infoBox(inhalt: string): string {
  return `<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:16px 18px;margin:16px 0;color:#134e4a;font-size:14px;line-height:1.6;">${inhalt}</div>`
}

export { esc }
