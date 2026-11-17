import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../test/msw-server'

import { holeDetails, holeHoldings, holeOwners, sucheUnternehmen } from './client'

/**
 * OpenRegister-REST-Client gegen MSW-Handler (deterministisch, keine
 * echten Credits). env.ts liest process.env live – vi.stubEnv genügt.
 * Geprüft: Kostenmodell (Autocomplete + Filtersuche inkl. rechtsform-
 * bereinigter Variante), Dedup nach company_id und die Best-Effort-
 * Verträge (null/[] statt Wurf).
 */

const BASIS = 'https://api.openregister.de'

const TREFFER_A = { company_id: 'DE-A1', name: 'Alpha GmbH', active: true }
const TREFFER_B = { company_id: 'DE-B2', name: 'Beta Handels-GmbH', active: true }
const TREFFER_C = { company_id: 'DE-C3', name: 'Gamma e. K.', active: false }

interface SuchFang {
  autocomplete: string[]
  filtersuche: string[]
  andere: string[]
}

function registriereFang(fang: SuchFang, autocompletergebnis: unknown[], filterergebnis: unknown[]): void {
  server.use(
    http.get(`${BASIS}/v1/autocomplete/company`, ({ request }) => {
      fang.autocomplete.push(new URL(request.url).searchParams.get('query') ?? '')
      return HttpResponse.json({ results: autocompletergebnis })
    }),
    http.post(`${BASIS}/v1/search/company`, async ({ request }) => {
      const body = (await request.json()) as { query: { value: string } }
      fang.filtersuche.push(body.query.value)
      return HttpResponse.json({ results: filterergebnis })
    }),
    // Fallback: alle anderen Endpunkte (Details/Owners/Holdings) protokollieren.
    http.all(`${BASIS}/*`, ({ request }) => {
      fang.andere.push(request.url)
      return HttpResponse.json({})
    }),
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sucheUnternehmen', () => {
  it('ohne API-Key: keine Anfrage, leere Trefferliste', async () => {
    vi.stubEnv('OPENREGISTER_API_KEY', '')
    const fang: SuchFang = { autocomplete: [], filtersuche: [], andere: [] }
    registriereFang(fang, [TREFFER_A], [])

    await expect(sucheUnternehmen('Alpha GmbH')).resolves.toEqual([])
    expect(fang.andere).toEqual([])
    expect(fang.autocomplete).toEqual([])
    expect(fang.filtersuche).toEqual([])
  })

  it('mit API-Key: Autocomplete + Filtersuche werden kombiniert und nach company_id dedupliziert', async () => {
    vi.stubEnv('OPENREGISTER_API_KEY', 'or_test_1234567890')
    const fang: SuchFang = { autocomplete: [], filtersuche: [], andere: [] }
    registriereFang(fang, [TREFFER_A, TREFFER_B], [TREFFER_B, TREFFER_C])

    const treffer = await sucheUnternehmen('Alpha GmbH')
    // sucheUnternehmen liefert die RAW-API-Treffer (company_id); das Mapping
    // auf RegisterTreffer (companyId) passiert in mapTreffer beim Aufrufer.
    expect(treffer.map((t) => t.company_id)).toEqual(['DE-A1', 'DE-B2', 'DE-C3'])
    // Je Variante (Original + rechtsformbereinigt, lowercase) eine Abfrage.
    expect(fang.autocomplete).toEqual(['Alpha GmbH', 'alpha'])
    expect(fang.filtersuche).toEqual(['Alpha GmbH', 'alpha'])
  })

  it('rechtsformbereinigte Suchvariante wird als zweite Query mitgeschickt', async () => {
    vi.stubEnv('OPENREGISTER_API_KEY', 'or_test_1234567890')
    const fang: SuchFang = { autocomplete: [], filtersuche: [], andere: [] }
    registriereFang(fang, [], [])

    await sucheUnternehmen('Mueller Werkzeugbau GmbH')
    // Original + rechtsformbereinigte Variante (normalisiereSuchbegriff liefert
    // lowercase, siehe mapping.ts), je Endpunkt eine Abfrage pro Variante.
    expect(fang.autocomplete).toEqual(['Mueller Werkzeugbau GmbH', 'mueller werkzeugbau'])
    expect(fang.filtersuche).toEqual(['Mueller Werkzeugbau GmbH', 'mueller werkzeugbau'])
  })

  it('Suchbegriff unter 3 Zeichen: sofort leer, ohne Anfrage', async () => {
    vi.stubEnv('OPENREGISTER_API_KEY', 'or_test_1234567890')
    const fang: SuchFang = { autocomplete: [], filtersuche: [], andere: [] }
    registriereFang(fang, [TREFFER_A], [])

    await expect(sucheUnternehmen('AB')).resolves.toEqual([])
    expect(fang.andere).toEqual([])
  })
})

describe('holeDetails / holeOwners / holeHoldings', () => {
  it('ohne API-Key: null, ohne Anfrage', async () => {
    vi.stubEnv('OPENREGISTER_API_KEY', '')
    const fang: SuchFang = { autocomplete: [], filtersuche: [], andere: [] }
    registriereFang(fang, [], [])

    await expect(holeDetails('DE-A1')).resolves.toBeNull()
    expect(fang.andere).toEqual([])
  })

  it('HTTP 500 → best effort null (Journey läuft ohne Registerdaten weiter)', async () => {
    vi.stubEnv('OPENREGISTER_API_KEY', 'or_test_1234567890')
    server.use(http.get(`${BASIS}/v1/company/DE-A1`, () => new HttpResponse('kaputt', { status: 500 })))
    const konsolenSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(holeDetails('DE-A1')).resolves.toBeNull()
    konsolenSpy.mockRestore()
  })

  it('Details, Owners und Holdings werden gelesen und die Antwortstrukturen gemappt', async () => {
    vi.stubEnv('OPENREGISTER_API_KEY', 'or_test_1234567890')
    server.use(
      http.get(`${BASIS}/v1/company/DE-A1`, () =>
        HttpResponse.json({
          id: 'DE-A1',
          name: { name: 'Alpha GmbH', legal_form: 'gmbh' },
          indicators: [
            { date: '2025-12-31', employees: 42, revenue: 8_500_000_00, balance_sheet_total: 6_200_000_00 },
          ],
        }),
      ),
      http.get(`${BASIS}/v1/company/DE-A1/owners`, () =>
        HttpResponse.json({ owners: [{ name: 'Hans Alfa', type: 'natural_person', percentage_share: 100 }] }),
      ),
      http.get(`${BASIS}/v1/company/DE-A1/holdings`, () =>
        HttpResponse.json({ holdings: [{ company_id: 'DE-B2', name: 'Beta GmbH', percentage_share: 80 }] }),
      ),
    )

    const details = await holeDetails('DE-A1')
    expect(details?.name?.name).toBe('Alpha GmbH')
    expect(details?.indicators?.[0]?.revenue).toBe(8_500_000_00) // Cent! Umrechnung passiert im Mapping.
    await expect(holeOwners('DE-A1')).resolves.toHaveLength(1)
    await expect(holeHoldings('DE-A1')).resolves.toHaveLength(1)
  })
})
