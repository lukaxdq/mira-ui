import { useEffect, useState } from 'react'
import { useSettings } from '@/settings'
import { detectTimezone, useDetectedZone } from '@/utils/timezone'
import styles from './ClockScreen.module.scss'

interface Props {
  onExit?: () => void
}

// The device clock is set to UTC (see firmware clock_sync). getTimezoneOffset()
// returns the local offset in minutes EAST of UTC, i.e. UTC = local - offset,
// so we add it to the UTC wall time to get the local clock.
//
// In auto mode the real offset comes from the IP-detected IANA zone (see
// utils/timezone.ts) — the device's raw getTimezoneOffset() is always 0 since
// the system clock runs in UTC. The device-zone fallback only applies until
// the detection resolves (or offline with no cache).
function localOffsetMinutes(mode: 'auto' | 'manual', manual: number, detected: number | null): number {
  if (mode === 'manual') return manual
  return detected ?? -new Date().getTimezoneOffset()
}

export default function ClockScreen({ onExit }: Props) {
  const { timezoneMode, utcOffsetMinutes, timeFormat } = useSettings()
  const detected = useDetectedZone()
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // kick off IP-based detection once; a warm cache resolves without network
  useEffect(() => {
    void detectTimezone()
  }, [])

  const offset = localOffsetMinutes(timezoneMode, utcOffsetMinutes, detected?.offsetMinutes ?? null)
  // shift the UTC wall time by the offset, then read the fields as UTC
  const local = new Date(now.getTime() + offset * 60_000)
  const h24 = local.getUTCHours()
  const minutes = local.getUTCMinutes().toString().padStart(2, '0')
  const seconds = local.getUTCSeconds().toString().padStart(2, '0')

  let hours: string
  let period: string | null = null
  if (timeFormat === '12h') {
    const h12 = h24 % 12
    hours = (h12 === 0 ? 12 : h12).toString()
    period = h24 < 12 ? 'AM' : 'PM'
  } else {
    hours = h24.toString().padStart(2, '0')
  }

  return (
    <div className={styles.root} onClick={() => onExit && onExit()} role="button">
      <div className={styles.time} aria-hidden>
        {hours}:{minutes}
        {period && <span className={styles.period}>{period}</span>}
      </div>
      <div className={styles.seconds}>{seconds}</div>
    </div>
  )
}
