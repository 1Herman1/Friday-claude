import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './catalog-composition.css'

interface CatalogCrossfadeTileProps {
  to: string
  title: string
  count?: string
  className?: string
  scenes: readonly string[]
}

export function CatalogCrossfadeTile(props: CatalogCrossfadeTileProps) {
  return <CrossfadeContent key={props.scenes.join('\n')} {...props} />
}

function CrossfadeContent({ to, title, count, className = '', scenes }: CatalogCrossfadeTileProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)
  const [ready, setReady] = useState<Set<string>>(() => new Set())
  const [frame, setFrame] = useState(scenes[0])
  const [allowed, setAllowed] = useState(false)
  const [visible, setVisible] = useState(false)
  const [loadScenes, setLoadScenes] = useState(false)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    mounted.current = true
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection
    let onscreen = false
    const update = () => {
      setAllowed(!reduced.matches && !connection?.saveData)
      setVisible(onscreen && !document.hidden)
      if (onscreen && !document.hidden && !reduced.matches && !connection?.saveData) setLoadScenes(true)
    }
    const observer = new IntersectionObserver(([entry]) => { onscreen = entry.isIntersecting; update() })
    if (ref.current) observer.observe(ref.current)
    reduced.addEventListener('change', update)
    connection?.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    update()
    return () => {
      mounted.current = false
      observer.disconnect()
      reduced.removeEventListener('change', update)
      connection?.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  const available = scenes.filter(src => ready.has(src))
  const current = allowed && ready.has(frame) ? frame : available[0] ?? scenes[0]
  useEffect(() => {
    if (!allowed || !visible || paused || hovered || focused || ready.size < 2) return
    // Designer choice: creams enter one second later, avoiding simultaneous swaps.
    const phaseMs = to === '/catalog/kremy-dlya-litsa-i-shei' ? 1000 : 0
    const advance = () => setFrame(previous => {
      const loaded = scenes.filter(src => ready.has(src))
      return loaded[(loaded.indexOf(previous) + 1) % loaded.length]
    })
    let interval: number | undefined
    const first = window.setTimeout(() => {
      advance()
      interval = window.setInterval(advance, 2000)
    }, 2000 + phaseMs)
    return () => { window.clearTimeout(first); window.clearInterval(interval) }
  }, [allowed, visible, paused, hovered, focused, ready, scenes, to])

  const markReady = async (image: HTMLImageElement, src: string) => {
    try {
      await image.decode()
      if (mounted.current) setReady(previous => new Set(previous).add(src))
    } catch {
      if (mounted.current) setReady(previous => { const next = new Set(previous); next.delete(src); return next })
    }
  }

  return <div ref={ref} className={`catalog-tile catalog-crossfade ${className}`}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false) }}>
    <Link to={to} className="catalog-cover-link">
      <div className="catalog-tile-copy"><h2>{title}</h2>{count && <p className="catalog-count">{count}</p>}</div>
      {scenes.map(src => <img key={src} src={loadScenes || src === scenes[0] ? src : undefined} loading="lazy" alt="" className="catalog-scene" data-active={src === current}
        onLoad={event => { void markReady(event.currentTarget, src) }}
        onError={event => { event.currentTarget.style.visibility = 'hidden'; setReady(previous => { const next = new Set(previous); next.delete(src); return next }) }} />)}
      <span className="catalog-arrow" aria-hidden="true">↗</span>
    </Link>
    {allowed && ready.size >= 2 && <button type="button" className="catalog-motion-control" aria-pressed={paused}
      aria-label={`${paused ? 'Продолжить' : 'Приостановить'} смену товаров: ${title}`}
      onClick={() => setPaused(value => !value)}>{paused ? 'Продолжить смену товаров' : 'Приостановить смену товаров'}</button>}
  </div>
}
