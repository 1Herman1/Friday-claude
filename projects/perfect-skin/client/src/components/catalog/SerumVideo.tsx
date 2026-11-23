import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import './serum-video.css'

export const SERUM_VIDEO = '/photos/catalog/serum-approved-60fps.mp4'
export const SERUM_POSTER = '/photos/catalog/serum-approved-final.png'

const Playback = createContext<{ finished: boolean; finish: () => void } | null>(null)

export function SerumVideoScope({ children }: { children: ReactNode }) {
  const [finished, setFinished] = useState(false)
  return <Playback.Provider value={{ finished, finish: () => setFinished(true) }}>{children}</Playback.Provider>
}

export function SerumVideo() {
  const playback = useContext(Playback)
  const holder = useRef<HTMLSpanElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [load, setLoad] = useState(false)
  const [active, setActive] = useState(false)
  const [locallyFinished, setFinished] = useState(false)
  const finished = playback?.finished || locallyFinished
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection
    let visible = false
    const update = () => {
      const permitted = visible && !document.hidden && !reduced.matches && !connection?.saveData
      setActive(permitted)
      if (permitted) setLoad(true)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.25
      update()
    }, { threshold: [0, 0.25] })
    if (holder.current) observer.observe(holder.current)
    reduced.addEventListener('change', update)
    connection?.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    update()
    return () => {
      observer.disconnect()
      reduced.removeEventListener('change', update)
      connection?.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  useEffect(() => {
    const element = video.current
    if (!element) return
    let cancelled = false
    if (active && !finished && !failed) {
      void element.play().catch(() => { if (!cancelled) setFailed(true) })
    } else element.pause()
    return () => { cancelled = true; element.pause() }
  }, [active, load, finished, failed])

  return <span ref={holder} className="catalog-serum-media" aria-hidden="true" data-finished={finished} data-failed={failed}>
    <img src={SERUM_POSTER} className="catalog-serum-poster" alt="" loading="lazy" />
    {load && !failed && !finished && <video ref={video} src={SERUM_VIDEO} poster={SERUM_POSTER}
      className="catalog-serum-video" autoPlay={active && !finished} muted playsInline preload="none" tabIndex={-1}
      hidden={finished || !active} disablePictureInPicture disableRemotePlayback
      onEnded={() => { setFinished(true); playback?.finish() }} onError={() => setFailed(true)} />}
  </span>
}
