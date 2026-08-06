import { memo, useEffect, useRef, useState } from 'react'
import { fetchPlaylists } from '@/api/client'
import type { Playlist } from '@/api/types'
import styles from './Playlists.module.scss'

interface Props {
  open: boolean
  onClose: () => void
  onPlay: (uri: string) => void
}

// Full-screen playlist library view with a horizontally scrollable row of
// playlist cards, opened by double-pressing back.
function PlaylistsImpl({ open, onPlay }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playingUri, setPlayingUri] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) return
    if (loadedRef.current && playlists.length > 0) return

    setLoading(true)
    setError(null)
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    void fetchPlaylists(ac.signal)
      .then((list) => {
        loadedRef.current = true
        setPlaylists(list)
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load playlists')
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })

    return () => ac.abort()
  }, [open, playlists.length])

  // reset transient state on close
  useEffect(() => {
    if (!open) {
      setPlayingUri(null)
    }
  }, [open])

  if (!open) return null

  const handlePlay = (p: Playlist) => {
    setPlayingUri(p.uri)
    onPlay(p.uri)
  }

  return (
    <div className={styles.root} role="dialog" aria-modal="true">
      <div className={styles.header}>
        <span className={styles.title}>Your Playlists</span>
        <span className={styles.count}>
          {playlists.length > 0 ? `${playlists.length} playlists` : ''}
        </span>
      </div>

      {loading && playlists.length === 0 ? (
        <div className={styles.state}>Loading…</div>
      ) : error ? (
        <div className={styles.state}>{error}</div>
      ) : playlists.length === 0 ? (
        <div className={styles.state}>No playlists found</div>
      ) : (
        <div className={styles.scroll}>
          <ul className={styles.row}>
            {playlists.map((p) => (
              <li key={p.id} className={styles.cell}>
                <button
                  type="button"
                  className={styles.card}
                  onClick={() => handlePlay(p)}
                  aria-label={`Play ${p.name}`}
                >
                  <span className={styles.cover}>
                    {p.image_url ? (
                      <img src={p.image_url} alt="" loading="lazy" />
                    ) : (
                      <span className={styles.thumbFallback} aria-hidden>
                        ♪
                      </span>
                    )}
                    {playingUri === p.uri ? (
                      <span className={styles.playingBadge} aria-label="playing">
                        <span className={styles.playingBars} aria-hidden>
                          <i />
                          <i />
                          <i />
                        </span>
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.name}>{p.name}</span>
                  <span className={styles.sub}>
                    Playlist
                    {p.owner ? ` · ${p.owner}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.hint}>Press back to exit</div>
    </div>
  )
}

export const Playlists = memo(PlaylistsImpl)
