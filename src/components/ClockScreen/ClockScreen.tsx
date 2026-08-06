import { useEffect, useState } from 'react'
import { useSettings } from '@/settings'
import styles from './ClockScreen.module.scss'

interface Props {
  onExit?: () => void
}

// The device clock is set to UTC (see firmware clock_sync). getTimezoneOffset()
// returns the local offset in minutes EAST of UTC, i.e. UTC = local - offset,
// so we add it to the UTC wall time to get the local clock.
function localOffsetMinutes(mode: 'auto' | 'manual', manual: number): number {
  if (mode === 'manual') return manual
  return -new Date().getTimezoneOffset()
}

export default function ClockScreen({ onExit }: Props) {
  const { timezoneMode, utcOffsetMinutes, timeFormat } = useSettings()
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const offset = localOffsetMinutes(timezoneMode, utcOffsetMinutes)
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
