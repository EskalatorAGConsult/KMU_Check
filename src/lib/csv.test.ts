import { describe, expect, it } from 'vitest'

import { baueCsv, csvZeile } from './csv'

describe('CSV-Builder (Excel-DE)', () => {
  it('trennt mit Semikolon und laesst einfache Werte unquotiert', () => {
    expect(csvZeile(['a', 'b', 3])).toBe('a;b;3')
  })

  it('quotiert Semikolon, Zeilenumbrueche und Anfuehrungszeichen korrekt', () => {
    expect(csvZeile(['Müller; GmbH', 'Zeile1\nZeile2', 'sag "Hallo"'])).toBe(
      '"Müller; GmbH";"Zeile1\nZeile2";"sag ""Hallo"""',
    )
  })

  it('formatiert Zahlen deutsch (Komma) und null als leer', () => {
    expect(csvZeile([26750.5, null, undefined])).toBe('26750,5;;')
  })

  it('liefert BOM + Kopf + CRLF-Zeilen', () => {
    const csv = baueCsv(['Name', 'Wert'], [['x', 1], ['y', 2]])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Name;Wert\r\nx;1\r\ny;2\r\n')
  })

  it('neutralisiert Excel-Formel-Injektion (CWE-1236)', () => {
    // Fuhrende Formelzeichen bekommen einen Apostroph-Praefix – Quoting
    // allein wuerde die Formel in Excel weiterhin ausfuehren.
    expect(csvZeile(['=WEBSERVICE("https://boese.tld")'])).toBe("\"'=WEBSERVICE(\"\"https://boese.tld\"\")\"")
    expect(csvZeile(['+cmd|/C calc!A0'])).toBe("'+cmd|/C calc!A0")
    expect(csvZeile(['-2+3|cmd']).startsWith("'")).toBe(true)
    expect(csvZeile(['@SUMME(A1:A9)'])).toBe("'@SUMME(A1:A9)")
    // Mit fuehrenden Leerzeichen ist die Formel weiterhin aktiv -> auch dann
    expect(csvZeile(['  =HYPERLINK("x")'])).toBe("\"'  =HYPERLINK(\"\"x\"\")\"")
    // Normale Werte und Zahlen bleiben unberuehrt
    expect(csvZeile(['Müller GmbH', -42])).toBe('Müller GmbH;-42')
  })
})
