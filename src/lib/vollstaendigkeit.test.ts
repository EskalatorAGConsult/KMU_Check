import { describe, expect, it } from 'vitest'

import { pruefeVollstaendigkeit, type VollstaendigkeitsEingabe } from './vollstaendigkeit'

/** Vollstaendigkeits-Check: Vertrag der Einreichungsreife (BAFA Modul 3). */

const komplett: VollstaendigkeitsEingabe = {
  stammdaten: {
    unternehmensname: 'Müller GmbH',
    plz: '08060',
    ort: 'Zwickau',
    strasse: 'Industriestr. 12',
    email: 'info@example.de',
    wz_code: '25.11',
    personenart: 'juristisch',
    steuernummer: '123/456/78901',
    steuer_id: null,
    geburtsdatum: null,
    kontoinhaber: 'Müller GmbH',
    iban: 'DE89370400440532013000',
    ap_vorname: 'Jürgen',
    ap_nachname: 'Müller',
    ap_email: 'jm@example.de',
  },
  kmuBewertungen: [
    { geschaeftsjahr: 2025, kategorie: 'klein' },
    { geschaeftsjahr: 2024, kategorie: 'klein' },
  ],
  deminimis: { angebot_id: 'a1' },
  vollmacht: { beantragungsweg: 'eskalator', unterzeichnet_von: 'J. Müller', pdf_path: 'https://x/v.pdf', signatur_bild_path: null },
  dokumente: [{ typ: 'systemkonzept' }],
}

describe('pruefeVollstaendigkeit', () => {
  it('vollstaendiger Vorgang ist einreichungsreif', () => {
    const r = pruefeVollstaendigkeit(komplett)
    expect(r.vollstaendig).toBe(true)
    expect(r.offen).toEqual([])
    expect(r.bausteine.every((b) => b.ok)).toBe(true)
  })

  it('leerer Vorgang: alle Bausteine offen, mit verstaendlichen Hinweisen', () => {
    const r = pruefeVollstaendigkeit({
      stammdaten: null,
      kmuBewertungen: [],
      deminimis: null,
      vollmacht: null,
      dokumente: [],
    })
    expect(r.vollstaendig).toBe(false)
    expect(r.offen.length).toBe(r.bausteine.length)
    for (const b of r.bausteine) expect(b.hinweis).toBeTruthy()
  })

  it('juristische Person braucht Steuernummer, natuerliche Steuer-ID + Geburtsdatum', () => {
    const jurOhne = pruefeVollstaendigkeit({
      ...komplett,
      stammdaten: { ...komplett.stammdaten!, steuernummer: null },
    })
    const bank = jurOhne.bausteine.find((b) => b.id === 'steuer_bank')!
    expect(bank.ok).toBe(false)
    expect(bank.hinweis).toMatch(/Steuernummer/)

    const natOhne = pruefeVollstaendigkeit({
      ...komplett,
      stammdaten: {
        ...komplett.stammdaten!,
        personenart: 'natuerlich',
        steuernummer: null,
        steuer_id: null,
        geburtsdatum: null,
      },
    })
    const bankNat = natOhne.bausteine.find((b) => b.id === 'steuer_bank')!
    expect(bankNat.hinweis).toMatch(/Steuer-ID/)
    expect(bankNat.hinweis).toMatch(/Geburtsdatum/)
  })

  it('KMU braucht beide Geschaeftsjahre mit Kategorie', () => {
    const einJahr = pruefeVollstaendigkeit({ ...komplett, kmuBewertungen: [{ geschaeftsjahr: 2025, kategorie: 'klein' }] })
    expect(einJahr.bausteine.find((b) => b.id === 'kmu')!.ok).toBe(false)
    const ohneKat = pruefeVollstaendigkeit({
      ...komplett,
      kmuBewertungen: [
        { geschaeftsjahr: 2025, kategorie: null },
        { geschaeftsjahr: 2024, kategorie: null },
      ],
    })
    expect(ohneKat.bausteine.find((b) => b.id === 'kmu')!.hinweis).toMatch(/Kategorie/)
  })

  it('Eskalator-Vollmacht braucht Unterschrift und Nachweis; „selbst“ ist sofort ok', () => {
    const ohneNachweis = pruefeVollstaendigkeit({
      ...komplett,
      vollmacht: { beantragungsweg: 'eskalator', unterzeichnet_von: 'J. Müller', pdf_path: null, signatur_bild_path: null },
    })
    expect(ohneNachweis.bausteine.find((b) => b.id === 'vollmacht')!.ok).toBe(false)
    const selbst = pruefeVollstaendigkeit({
      ...komplett,
      vollmacht: { beantragungsweg: 'selbst', unterzeichnet_von: null, pdf_path: null, signatur_bild_path: null },
    })
    expect(selbst.bausteine.find((b) => b.id === 'vollmacht')!.ok).toBe(true)
  })

  it('Systemkonzept ist Pflichtanlage', () => {
    const r = pruefeVollstaendigkeit({ ...komplett, dokumente: [{ typ: 'angebot_pdf' }] })
    expect(r.bausteine.find((b) => b.id === 'systemkonzept')!.ok).toBe(false)
  })
})
