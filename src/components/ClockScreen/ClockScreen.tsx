import { useEffect, useState } from 'react'
import styles from './ClockScreen.module.scss'

interface Props {
  onExit?: () => void
}

export default function ClockScreen({ onExit }: Props) {
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')

  return (
    <div className={styles.root} onClick={() => onExit && onExit()} role="button">
      <div className={styles.time} aria-hidden>
        {hours}:{minutes}
      </div>
      <div className={styles.seconds}>{seconds}</div>
    </div>
  )
}
