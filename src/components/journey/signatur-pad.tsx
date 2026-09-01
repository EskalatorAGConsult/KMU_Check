'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Signatur-Pad: Freihand-Unterschrift per Finger, Stift oder Maus.
 *
 * Technik:
 * - Pointer Events (vereinheitlicht Touch/Maus/Stift), `touch-action: none`
 *   gegen Scrollen auf iOS, Pointer-Capture fuer Striche ausserhalb der Flaeche.
 * - devicePixelRatio-Skalierung (2x) fuer eine scharfe Signatur im PDF.
 * - Geglaettete Striche ueber quadratische Kurven durch Mittelpunkte.
 * - Export als transparentes PNG (Data-URL) bei jedem abgeschlossenen Strich;
 *   ein bereits gespeicherter Wert (Entwurf) wird als Vorschau gezeigt und kann
 *   ueber „Neu unterschreiben" ersetzt werden.
 */

/** Logische Zeichenflaeche in CSS-Pixeln (Seitenverhaeltnis passt zur Signaturzeile des Formulars). */
const BREITE = 620
const HOEHE = 190
/** Max. Groesse der exportierten Data-URL (Zeichen) – Schutz vor Monster-Payloads. */
const MAX_DATA_URL = 350_000

interface Punkt {
  x: number
  y: number
}

export function SignaturPad({
  wert,
  fehler,
  onChange,
}: {
  /** Gespeicherte Signatur (Data-URL) – z. B. aus einem wiederhergestellten Entwurf. */
  wert: string | null
  fehler?: string
  onChange: (dataUrl: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stricheRef = useRef(0)
  const zeichnetRef = useRef(false)
  const letzterPunktRef = useRef<Punkt | null>(null)
  const [bearbeite, setBearbeite] = useState(false)
  const [hatStriche, setHatStriche] = useState(false)

  const zeigtVorschau = !!wert && !bearbeite

  /** Canvas an CSS-Groesse + devicePixelRatio anpassen (scharf auf Retina/iPhone). */
  const initialisiereCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssBreite = canvas.clientWidth || BREITE
    const cssHoehe = Math.round((cssBreite * HOEHE) / BREITE)
    canvas.width = cssBreite * dpr
    canvas.height = cssHoehe * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#16283f' // mabe-navy
    ctx.lineWidth = 2.4
  }, [])

  useEffect(() => {
    if (!zeigtVorschau) initialisiereCanvas()
  }, [zeigtVorschau, initialisiereCanvas, bearbeite])

  const exportiere = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    onChange(dataUrl.length <= MAX_DATA_URL ? dataUrl : null)
  }

  const punktAus = (e: React.PointerEvent<HTMLCanvasElement>): Punkt => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const beginneStrich = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    zeichnetRef.current = true
    const p = punktAus(e)
    letzterPunktRef.current = p
    // Einzelner Tap = Punkt (damit auch Punkte/i-Punkte sichtbar werden)
    const ctx = e.currentTarget.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fillStyle = ctx.strokeStyle
      ctx.fill()
    }
  }

  const fuehreStrich = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!zeichnetRef.current) return
    const ctx = e.currentTarget.getContext('2d')
    const von = letzterPunktRef.current
    if (!ctx || !von) return
    // Coalesced Events nutzen (fluessige Striche bei hoher Abtastrate, z. B. Stift)
    const ereignisse = 'getCoalescedEvents' in e.nativeEvent ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent]
    for (const ev of ereignisse) {
      const rect = e.currentTarget.getBoundingClientRect()
      const nach: Punkt = { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
      const mitte: Punkt = { x: (von.x + nach.x) / 2, y: (von.y + nach.y) / 2 }
      ctx.beginPath()
      ctx.moveTo(von.x, von.y)
      ctx.quadraticCurveTo(von.x, von.y, mitte.x, mitte.y)
      ctx.lineTo(nach.x, nach.y)
      ctx.stroke()
      letzterPunktRef.current = nach
    }
  }

  const beendeStrich = () => {
    if (!zeichnetRef.current) return
    zeichnetRef.current = false
    letzterPunktRef.current = null
    stricheRef.current += 1
    setHatStriche(true)
    exportiere()
  }

  const zuruecksetzen = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    stricheRef.current = 0
    setHatStriche(false)
    setBearbeite(true)
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-white ${
          fehler ? 'border-red-400' : 'border-olive-300'
        }`}
      >
        {zeigtVorschau ? (
          <div className="flex flex-col items-center gap-2 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- Data-URL der Unterschrift, kein optimierbares Asset */}
            <img
              src={wert}
              alt="Ihre gespeicherte Unterschrift"
              className="max-h-40 w-full rounded-lg bg-white object-contain ring-1 ring-olive-100"
            />
            <button
              type="button"
              onClick={() => {
                setBearbeite(true)
                onChange(null)
              }}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              Neu unterschreiben
            </button>
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Unterschrift mit Finger, Stift oder Maus zeichnen"
              className="block h-44 w-full touch-none sm:h-48"
              onPointerDown={beginneStrich}
              onPointerMove={fuehreStrich}
              onPointerUp={beendeStrich}
              onPointerCancel={beendeStrich}
            />
            {!hatStriche && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-olive-400">
                Hier mit dem Finger oder der Maus unterschreiben
              </p>
            )}
            {/* Signaturgrundlinie wie im Papierformular */}
            <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-olive-300" aria-hidden />
          </>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px]/4 text-olive-500">
          Die Unterschrift wird an der vorgesehenen Stelle des BAFA-Formulars eingezeichnet.
        </p>
        {!zeigtVorschau && hatStriche && (
          <button
            type="button"
            onClick={zuruecksetzen}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-olive-600 hover:bg-olive-100"
          >
            Zurücksetzen
          </button>
        )}
      </div>
      {fehler && (
        <p className="text-xs/5 font-medium text-red-700" role="alert">
          {fehler}
        </p>
      )}
    </div>
  )
}
