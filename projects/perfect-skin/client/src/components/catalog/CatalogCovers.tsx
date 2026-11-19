import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export const SERUM_COVER = '/photos/catalog/syvorotki-pilot-05-native.png'

/** One local gate for visibility, reduced motion and data saving. */
function useCoverMotion() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection
    let visible = false
    const update = () => {
      const allowed = !reduced.matches && !connection?.saveData
      setEnabled(allowed)
      setActive(allowed && visible && !document.hidden)
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() }, { threshold: 0 })
    if (ref.current) observer.observe(ref.current)
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
  return { ref, active, enabled }
}

const PACKSHOTS = [
  '/products/bb-cream-matiruyushhij-krem.jpg',
  '/products/4d-hyal-cross-superuvlazhnyayushhaya-syvorotka.jpg',
  '/products/podarochnyj-nabor-expert-team-box-1-dlya-glubokogo-ochishhen-2.jpg',
]

export function AllProductsCover() {
  const { ref, active, enabled } = useCoverMotion()
  const [frame, setFrame] = useState(0)
  const [paused, setPaused] = useState(false)
  const ready = useRef(new Set<number>())
  useEffect(() => {
    if (!active || paused) return
    const timer = window.setInterval(() => setFrame(current => {
      for (let step = 1; step < PACKSHOTS.length; step++) {
        const next = (current + step) % PACKSHOTS.length
        if (ready.current.has(next)) return next
      }
      return current
    }), 4800)
    return () => window.clearInterval(timer)
  }, [active, paused])
  return <div ref={ref} className="catalog-tile catalog-all catalog-span-3 bg-accent text-foreground">
    <Link to="/catalog/all" className="catalog-cover-link">
      <div className="catalog-tile-copy"><h2>Все средства</h2></div>
      {PACKSHOTS.map((src, i) => <img key={src} src={src} alt="" className="catalog-packshot" data-active={i === frame}
        onLoad={() => { ready.current.add(i); if (!ready.current.has(frame)) setFrame(i) }}
        onError={() => { ready.current.delete(i); if (i === frame) setFrame(ready.current.values().next().value ?? frame) }} />)}
      <span className="catalog-arrow" aria-hidden="true">↗</span>
    </Link>
    {enabled && <button type="button" className="catalog-motion-control" aria-label={paused ? 'Продолжить смену товаров' : 'Приостановить смену товаров'} onClick={() => setPaused(!paused)}>{paused ? '▶' : 'Ⅱ'}</button>}
  </div>
}

export function BestsellerCover() {
  const { ref, active, enabled } = useCoverMotion()
  const video = useRef<HTMLVideoElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [paused, setPaused] = useState(false)
  const [ended, setEnded] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { if (active) setLoaded(true) }, [active])
  useEffect(() => {
    const element = video.current
    if (!element) return
    if (active && loaded && !paused && !ended && !failed) {
      let cancelled = false
      element.play().catch(() => { if (!cancelled) setPaused(true) })
      return () => { cancelled = true; element.pause() }
    }
    element.pause()
  }, [active, loaded, paused, ended, failed])
  const toggle = () => {
    if (ended && video.current) { video.current.currentTime = 0; setEnded(false); setPaused(false) }
    else setPaused(!paused)
  }
  return <div ref={ref} className="catalog-tile catalog-bestsellers catalog-span-4 bg-dark text-dark-foreground">
    <Link to="/catalog/all?sort=popular" className="catalog-cover-link">
      <div className="catalog-tile-copy"><h2>Бестселлеры</h2><p className="catalog-count">По популярности</p></div>
      {failed ? <img className="catalog-film" src="/video/bestsellers/desktop/k0.jpg" alt="" /> :
        <video ref={video} className="catalog-film" poster="/video/bestsellers/desktop/k0.jpg" src={loaded ? '/video/bestsellers/desktop/0-1.mp4' : undefined}
          muted playsInline preload="none" aria-hidden="true" onEnded={() => setEnded(true)} onError={() => setFailed(true)} />}
      <span className="catalog-arrow" aria-hidden="true">↗</span>
    </Link>
    {enabled && !failed && <button type="button" className="catalog-motion-control" aria-label={ended ? 'Повторить видео' : paused ? 'Продолжить видео' : 'Приостановить видео'} onClick={toggle}>{ended ? '↻' : paused ? '▶' : 'Ⅱ'}</button>}
  </div>
}
