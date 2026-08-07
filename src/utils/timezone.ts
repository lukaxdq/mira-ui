import { useSyncExternalStore } from 'react'

// IP-based auto timezone detection for the ClockScreen.
//
// The device's system clock runs in UTC (firmware clock_sync), so
// Date.prototype.getTimezoneOffset() always returns 0 and "Auto" would show UTC
// for everyone. Instead we geolocate the IP to an IANA zone and compute that
// zone's CURRENT UTC offset.
//
// Chromium-69 constraints honored here:
//  - no AbortSignal.timeout() (Chrome 103+), so we drive AbortController manually
//  - no Intl.DateTimeFormat.formatToParts() (Chrome 71+), so we parse the
//    formatted string instead
//  - IANA zone names via Intl work fine (Chrome 24+)

export interface DetectedZone {
  /** IANA zone name, e.g. "America/New_York" */
  zone: string
  /** Current UTC offset in minutes (positive east of UTC), DST-aware */
  offsetMinutes: number
  /** epoch ms the detection resolved */
  detectedAt: number
}

const CACHE_KEY = 'mira.tz.v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // re-detect weekly
const FETCH_TIMEOUT_MS = 5000

type ZonePicker = (data: unknown) => string | null

const PROVIDERS: Array<{ url: string; pick: ZonePicker }> = [
  {
    url: 'https://ipapi.co/json/',
    pick: (d) => (isRecord(d) && typeof d.timezone === 'string' ? d.timezone : null),
  },
  {
    url: 'https://get.geojs.io/v1/ip/geo.json',
    pick: (d) => (isRecord(d) && typeof d.timezone === 'string' ? d.timezone : null),
  },
  {
    url: 'https://ipwho.is/',
    pick: (d) => {
      if (!isRecord(d) || !isRecord(d.timezone)) return null
      const tz = d.timezone
      return typeof tz.id === 'string' ? tz.id : null
    },
  },
]

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

// Compute the zone's offset by formatting an absolute instant in that zone and
// comparing the resulting wall-clock fields back against the epoch. formatToParts
// is unavailable in Chromium 69, so parse the formatted string instead.
export function offsetMinutesForZone(zone: string, at: Date = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(at)
    // Chromium 69 en-US: "01/15/2024, 07:00:00" (hour may be "24" at midnight,
    // a pre-Chrome-70 bug we normalize below)
    const m = parts.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    if (!m) return null
    let hour = Number(m[4])
    let day = Number(m[2])
    if (hour === 24) {
      hour = 0
      day += 1
    }
    const asUtc = Date.UTC(Number(m[3]), Number(m[1]) - 1, day, hour, Number(m[5]), Number(m[6] ?? 0))
    // wall time minus epoch is the zone's offset at this instant
    return Math.round((asUtc - at.getTime()) / 60_000)
  } catch {
    return null // RangeError for unknown / malformed zone
  }
}

// The device's own resolved zone; with a UTC-only system this is typically
// "UTC" or "Etc/UTC", which is still a correct (0) fallback.
export function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

async function fetchJson(url: string, pick: ZonePicker): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return pick(await res.json())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchZone(): Promise<string | null> {
  for (const { url, pick } of PROVIDERS) {
    const zone = await fetchJson(url, pick)
    if (zone && offsetMinutesForZone(zone) !== null) return zone
  }
  // last resort: whatever the browser thinks the zone is
  const fallback = deviceZone()
  return offsetMinutesForZone(fallback) !== null ? fallback : null
}

// --- tiny store (mirrors settings.ts pattern) ---

function readCache(): DetectedZone | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<DetectedZone> | null
    if (
      d &&
      typeof d.zone === 'string' &&
      typeof d.offsetMinutes === 'number' &&
      typeof d.detectedAt === 'number' &&
      Number.isFinite(d.offsetMinutes)
    ) {
      return { zone: d.zone, offsetMinutes: d.offsetMinutes, detectedAt: d.detectedAt }
    }
  } catch {
    // ignore
  }
  return null
}

let current: DetectedZone | null = readCache()

const listeners = new Set<() => void>()
function emit(): void {
  for (const l of listeners) l()
}

function writeCache(d: DetectedZone): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(d))
  } catch {
    // ignore
  }
}

export function getDetectedZone(): DetectedZone | null {
  return current
}

export function subscribeDetectedZone(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useDetectedZone(): DetectedZone | null {
  return useSyncExternalStore(subscribeDetectedZone, getDetectedZone)
}

let inflight: Promise<DetectedZone | null> | null = null

// Resolve (or refresh) the detected zone. Safe to call concurrently from
// multiple places; a single fetch is shared. A successful local cache hit
// within TTL resolves immediately without network.
export async function detectTimezone(): Promise<DetectedZone | null> {
  const now = Date.now()
  if (current && now - current.detectedAt < CACHE_TTL_MS) return current

  if (inflight) return inflight

  inflight = (async () => {
    // re-read under the lock in case a previous call filled the cache
    if (current && Date.now() - current.detectedAt < CACHE_TTL_MS) return current

    const zone = await fetchZone()
    if (!zone) return current // keep stale cache (fallback) on failure

    const offsetMinutes = offsetMinutesForZone(zone)
    if (offsetMinutes === null) return current

    current = { zone, offsetMinutes, detectedAt: Date.now() }
    writeCache(current)
    emit()
    return current
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

// test-only
export function __resetDetectedZone(): void {
  current = readCache()
  emit()
}
