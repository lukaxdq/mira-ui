import { memo, useEffect, useRef, useState } from 'react'
import { fetchPlaylists } from '@/api/client'
import type { Playlist } from '@/api/types'
import styles from './Playlists.module.scss'

interface Props {
  open: boolean
  onClose: () => void
  onPlay: (uri: string) => void
}

// a compact, animated playlist picker accessed by double-pressing back
function PlaylistsImpl({ open, onClose, onPlay }: Props) {
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
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.card} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Playlists</span>
          <span className={styles.count}>{playlists.length > 0 ? `${playlists.length}` : ''}</span>
        </div>

        {loading && playlists.length === 0 ? (
          <div className={styles.state}>Loading…</div>
        ) : error ? (
          <div className={styles.state}>{error}</div>
        ) : playlists.length === 0 ? (
          <div className={styles.state}>No playlists found</div>
        ) : (
          <ul className={styles.list}>
            {playlists.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => handlePlay(p)}
                  aria-label={`Play ${p.name}`}
                >
                  <span className={styles.thumb}>
                    {p.image_url ? (
                      <img src={p.image_url} alt="" loading="lazy" />
                    ) : (
                      <span className={styles.thumbFallback} aria-hidden>
                        ♪
                      </span>
                    )}
                  </span>
                  <span className={styles.meta}>
                    <span className={styles.name}>{p.name}</span>
                    <span className={styles.sub}>
                      {p.track_count > 0 ? `${p.track_count} tracks` : 'Playlist'}
                      {p.owner ? ` · ${p.owner}` : ''}
                    </span>
                  </span>
                  {playingUri === p.uri ? <span className={styles.playingDot} aria-label="playing" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export const Playlists = memo(PlaylistsImpl)
