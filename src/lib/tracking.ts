/**
 * Erfasst Marketing-Attribution & Geräte-Signale für die Lead-Übergabe an den
 * Webhook: Google (gclid/gbraid/wbraid), Facebook/Meta (fbclid + _fbp/_fbc
 * Cookies), UTM-Parameter, Referrer, alle Cookies sowie ein FingerprintJS-
 * Besucher-Hash. Alles wird als JSON (versteckte Felder) an den Webhook gesendet.
 */

export interface TrackingData {
  // Klick-IDs
  gclid?: string
  gbraid?: string
  wbraid?: string
  fbclid?: string
  msclkid?: string
  ttclid?: string
  li_fat_id?: string
  // UTM
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  // Meta Cookies
  fbp?: string
  fbc?: string
  // Google Analytics
  ga_client_id?: string
  // Kontext
  landing_page: string
  referrer: string
  page_title: string
  user_agent: string
  language: string
  languages: string
  screen: string
  viewport: string
  timezone: string
  device_pixel_ratio: number
  platform: string
  // Fingerprint
  fingerprint_visitor_id?: string
  fingerprint_confidence?: number
  // Roh
  all_cookies: Record<string, string>
  all_query_params: Record<string, string>
  first_seen: string
  client_timestamp: string
}

const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id'] as const
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.split('; ').find((row) => row.startsWith(name + '='))
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined
}

function getAllCookies(): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof document === 'undefined') return out
  for (const part of document.cookie.split('; ')) {
    if (!part) continue
    const [k, ...v] = part.split('=')
    out[k] = decodeURIComponent(v.join('='))
  }
  return out
}

/** Liest die Google-Analytics-Client-ID aus dem _ga-Cookie (GA1.1.<id>.<ts>). */
function gaClientId(): string | undefined {
  const ga = getCookie('_ga')
  if (!ga) return undefined
  const parts = ga.split('.')
  return parts.length >= 4 ? `${parts[2]}.${parts[3]}` : ga
}

const FIRST_SEEN_KEY = 'mabe_kmu_first_seen'
const PERSIST_PREFIX = 'mabe_kmu_attr_'

/** Persistiert Klick-IDs/UTM beim ersten Besuch (überleben spätere Seitenaufrufe). */
function persistFirstTouch(params: URLSearchParams) {
  if (typeof localStorage === 'undefined') return
  for (const key of [...CLICK_ID_KEYS, ...UTM_KEYS]) {
    const val = params.get(key)
    if (val && !localStorage.getItem(PERSIST_PREFIX + key)) {
      localStorage.setItem(PERSIST_PREFIX + key, val)
    }
  }
}

function firstTouch(key: string, current?: string): string | undefined {
  if (current) return current
  if (typeof localStorage === 'undefined') return undefined
  return localStorage.getItem(PERSIST_PREFIX + key) ?? undefined
}

function firstSeen(): string {
  if (typeof localStorage === 'undefined') return new Date().toISOString()
  let v = localStorage.getItem(FIRST_SEEN_KEY)
  if (!v) {
    v = new Date().toISOString()
    localStorage.setItem(FIRST_SEEN_KEY, v)
  }
  return v
}

/** Baut den _fbc-Wert aus fbclid, falls Meta-Pixel ihn nicht gesetzt hat. */
function deriveFbc(fbclid?: string): string | undefined {
  const cookieFbc = getCookie('_fbc')
  if (cookieFbc) return cookieFbc
  if (!fbclid) return undefined
  return `fb.1.${Date.now()}.${fbclid}`
}

export function collectTracking(): TrackingData {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  persistFirstTouch(params)

  const data: TrackingData = {
    landing_page: typeof window !== 'undefined' ? window.location.href : '',
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    page_title: typeof document !== 'undefined' ? document.title : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    language: typeof navigator !== 'undefined' ? navigator.language : '',
    languages: typeof navigator !== 'undefined' ? (navigator.languages || []).join(',') : '',
    screen: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '',
    viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    device_pixel_ratio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    platform: typeof navigator !== 'undefined' ? navigator.platform : '',
    all_cookies: getAllCookies(),
    all_query_params: Object.fromEntries(params.entries()),
    first_seen: firstSeen(),
    client_timestamp: new Date().toISOString(),
  }

  const bag = data as unknown as Record<string, unknown>
  for (const key of CLICK_ID_KEYS) {
    const v = firstTouch(key, params.get(key) ?? undefined)
    if (v) bag[key] = v
  }
  for (const key of UTM_KEYS) {
    const v = firstTouch(key, params.get(key) ?? undefined)
    if (v) bag[key] = v
  }

  data.fbp = getCookie('_fbp')
  data.fbc = deriveFbc(data.fbclid)
  data.ga_client_id = gaClientId()

  return data
}

/** Reichert die Tracking-Daten asynchron mit dem FingerprintJS-Visitor-Hash an. */
export async function enrichWithFingerprint(data: TrackingData): Promise<TrackingData> {
  try {
    const FingerprintJS = (await import('@fingerprintjs/fingerprintjs')).default
    const agent = await FingerprintJS.load()
    const result = await agent.get()
    data.fingerprint_visitor_id = result.visitorId
    data.fingerprint_confidence = result.confidence?.score
  } catch {
    // Fingerprint ist optional – Lead-Übergabe darf daran nicht scheitern.
  }
  return data
}
