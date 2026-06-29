import type { CompanyInput, KmuResult } from './kmu'
import { CATEGORY_LABELS, formatEUR, formatNumber } from './kmu'

export interface LeadInfo {
  salutation: string
  firstName: string
  lastName: string
  position: string
  email: string
  phone: string
}

const NAVY: [number, number, number] = [11, 37, 69]
const TEAL: [number, number, number] = [28, 163, 169]
const GREY: [number, number, number] = [90, 100, 115]

/** Erzeugt einen gebrandeten KMU-Check-Nachweis als PDF (clientseitig). */
export async function generateKmuPdf(input: CompanyInput, result: KmuResult, lead?: LeadInfo): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 48
  let y = 0

  // Kopfband
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 96, 'F')
  doc.setFillColor(...TEAL)
  doc.rect(0, 96, W, 4, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('MABE', M, 46)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(170, 205, 210)
  doc.text('SMART CONTROL', M, 62)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('KMU-Fördercheck – Ergebnisnachweis', W - M, 50, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(170, 205, 210)
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, W - M, 66, { align: 'right' })

  y = 132

  // Unternehmen
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(input.companyName || 'Ihr Unternehmen', M, y)
  if (input.fiscalYear) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...GREY)
    doc.text(`Bezugsjahr: letztes abgeschlossenes Geschäftsjahr ${input.fiscalYear}`, M, y + 15)
    doc.setTextColor(...NAVY)
    y += 13
  }
  y += 26

  // Ergebnis-Box
  doc.setFillColor(244, 248, 249)
  doc.roundedRect(M, y, W - 2 * M, 92, 8, 8, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GREY)
  doc.text('Einstufung nach EU-Empfehlung 2003/361/EG', M + 18, y + 26)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...NAVY)
  doc.text(CATEGORY_LABELS[result.category], M + 18, y + 50)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GREY)
  doc.text('Mögliche Förderquote (BAFA Modul 3)', W - M - 18, y + 26, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.setTextColor(...TEAL)
  doc.text(`${result.fundingRatePct} %`, W - M - 18, y + 56, { align: 'right' })
  y += 92 + 30

  // Werte-Tabelle
  const row = (label: string, own: string, cons: string) => {
    doc.setDrawColor(225, 230, 235)
    doc.line(M, y, W - M, y)
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...GREY)
    doc.text(label, M, y)
    doc.setTextColor(...NAVY)
    doc.text(own, M + 300, y, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.text(cons, W - M, y, { align: 'right' })
    y += 8
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('Kennzahlen', M, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GREY)
  doc.text('Eigen', M + 300, y, { align: 'right' })
  doc.text('Verbund (fiktiv)', W - M, y, { align: 'right' })
  y += 10

  row(
    'Beschäftigte (Jahresarbeitseinheiten)',
    formatNumber(result.own.employees, 1),
    formatNumber(result.consolidated.employees, 1),
  )
  row('Jahresumsatz', formatEUR(result.own.turnover), formatEUR(result.consolidated.turnover))
  row('Bilanzsumme', formatEUR(result.own.balanceSheet), formatEUR(result.consolidated.balanceSheet))
  doc.setDrawColor(225, 230, 235)
  doc.line(M, y, W - M, y)
  y += 26

  // Beteiligungen
  if (input.holdings.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...NAVY)
    doc.text('Berücksichtigte Beteiligungen', M, y)
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GREY)
    for (const h of input.holdings) {
      const type = h.sharePct > 50 ? 'verbunden (100 %)' : `Partner (anteilig ${formatNumber(h.sharePct, 0)} %)`
      doc.text(
        `• ${h.name || 'Beteiligung'} – ${type}, ${formatNumber(h.employees, 1)} JAE, ${formatEUR(h.turnover)} Umsatz`,
        M,
        y,
      )
      y += 14
    }
    y += 12
  }

  // Begründung
  if (result.reasons.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...NAVY)
    doc.text('Begründung der Einstufung', M, y)
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GREY)
    for (const r of result.reasons) {
      const lines = doc.splitTextToSize(`• ${r}`, W - 2 * M)
      doc.text(lines, M, y)
      y += lines.length * 12
    }
    y += 12
  }

  // Ansprechpartner
  if (lead && (lead.lastName || lead.email)) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...NAVY)
    doc.text('Ihre Angaben', M, y)
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GREY)
    const name = [lead.salutation, lead.firstName, lead.lastName].filter(Boolean).join(' ')
    if (name) {
      doc.text(name + (lead.position ? `, ${lead.position}` : ''), M, y)
      y += 13
    }
    if (lead.email) {
      doc.text(lead.email, M, y)
      y += 13
    }
    if (lead.phone) {
      doc.text(lead.phone, M, y)
      y += 13
    }
  }

  // Fußnote / Disclaimer
  const footY = doc.internal.pageSize.getHeight() - 56
  doc.setDrawColor(225, 230, 235)
  doc.line(M, footY, W - M, footY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(140, 150, 160)
  const disclaimer = doc.splitTextToSize(
    'Dieser Nachweis ist eine unverbindliche Orientierung auf Basis Ihrer Angaben nach EU-Empfehlung 2003/361/EG. ' +
      'Ein Statuswechsel greift förderrechtlich erst, wenn ein Schwellenwert in zwei aufeinanderfolgenden Geschäftsjahren ' +
      'über- bzw. unterschritten wird. Maßgeblich ist die Prüfung durch die Bewilligungsbehörde. ' +
      'MABE Maschinen- und Behälterbau GmbH übernimmt keine Gewähr für Vollständigkeit und Richtigkeit.',
    W - 2 * M,
  )
  doc.text(disclaimer, M, footY + 14)

  return doc.output('blob')
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
