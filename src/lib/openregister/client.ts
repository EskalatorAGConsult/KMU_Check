import 'server-only'

/**
 * OpenRegister-API-Client (https://api.openregister.de, v1).
 * Liefert oeffentliche Handelsregister-/Bundesanzeiger-Daten:
 * Suche, Firmendetails inkl. Finanzkennzahlen, Gesellschafter (Owners)
 * und Beteiligungen (Holdings).
 *
 * Kostenmodell (Credits): Autocomplete 1, Details/Owners/Holdings je 10.
 * Antworten werden daher in `openregister_cache` (30 Tage) zwischengespeichert.
 *
 * Best effort: Jeder Fehler (fehlender Key, Netzwerk, 4xx/5xx) -> null,
 * die Journey funktioniert auch ohne Registerabfrage weiter.
 */

const BASIS = 'https://api.openregister.de'

// ---------- Antwort-Typen (nur die Felder, die wir konsumieren) ----------

export interface OrAdresse {
  street?: string | null
  postal_code?: string | null
  city?: string | null
  country?: string | null
  formatted_value?: string | null
}

export interface OrSuchTreffer {
  company_id: string
  name: string
  legal_form?: string | null
  active: boolean
  address?: OrAdresse | null
  register_court?: string | null
  register_type?: string | null
  register_number?: string | null
}

export interface OrIndikator {
  date: string
  employees?: number | null
  revenue?: number | null // Cent!
  balance_sheet_total?: number | null // Cent!
}

export interface OrDetails {
  id: string
  name?: { name?: string | null; legal_form?: string | null } | null
  legal_form?: string | null
  address?: OrAdresse | null
  industry_codes?: { WZ2025?: { code: string }[] } | null
  indicators?: OrIndikator[] | null
  status?: string | null
}

export interface OrOwner {
  id?: string | null // company_id bei juristischen Personen
  name: string
  type: 'legal_person' | 'natural_person' | string
  legal_person?: { name?: string | null; city?: string | null; country?: string | null } | null
  percentage_share?: number | null
  relation_type?: string | null
}

export interface OrHolding {
  company_id?: string | null
  name: string
  percentage_share?: number | null
  relation_type?: string | null
  end?: string | null // gesetzt = Beteiligung beendet
}

// ---------- HTTP-Helfer ----------

function apiKey(): string | null {
  return process.env.OPENREGISTER_API_KEY || null
}

async function rufeApi<T>(pfad: string): Promise<T | null> {
  const key = apiKey()
  if (!key) return null
  try {
    const res = await fetch(`${BASIS}${pfad}`, {
      headers: { Authorization: `Bearer ${key}` },
      // Registerdaten aendern sich selten – 1h HTTP-Cache auf Fetch-Ebene
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      console.error(`[openregister] ${pfad} -> HTTP ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (e) {
    console.error(`[openregister] ${pfad} fehlgeschlagen:`, e)
    return null
  }
}

// ---------- Oeffentliche Funktionen ----------

/** Autocomplete-Suche (1 Credit). Liefert leere Liste bei Fehler. */
export async function sucheUnternehmen(query: string): Promise<OrSuchTreffer[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const res = await rufeApi<{ results?: OrSuchTreffer[] }>(
    `/v1/autocomplete/company?query=${encodeURIComponent(q)}`,
  )
  return res?.results ?? []
}

/** Firmendetails inkl. Finanzkennzahlen der letzten Jahre (10 Credits). */
export async function holeDetails(companyId: string): Promise<OrDetails | null> {
  return rufeApi<OrDetails>(`/v1/company/${encodeURIComponent(companyId)}`)
}

/** Gesellschafter des Unternehmens (10 Credits). */
export async function holeOwners(companyId: string): Promise<OrOwner[] | null> {
  const res = await rufeApi<{ owners?: OrOwner[] }>(`/v1/company/${encodeURIComponent(companyId)}/owners`)
  return res ? (res.owners ?? []) : null
}

/** Beteiligungen des Unternehmens an anderen Firmen (10 Credits). */
export async function holeHoldings(companyId: string): Promise<OrHolding[] | null> {
  const res = await rufeApi<{ holdings?: OrHolding[] }>(
    `/v1/company/${encodeURIComponent(companyId)}/holdings`,
  )
  return res ? (res.holdings ?? []) : null
}
