import { useCallback, useEffect, useState } from 'react'

/** Наблюдатель для бесконечных idle-петель: ставит/снимает `is-onscreen`
    на контейнере, не отписывается (в отличие от useReveal).

    Callback-ref, а не useRef: с useRef + useEffect([]) эффект отрабатывал один
    раз при монтировании родителя, и если сам контейнер появляется позже (условный
    рендер после загрузки данных), ref был ещё null — наблюдатель не цеплялся
    никогда, анимация молча не запускалась. Тот же дефект прятал секцию брендов
    в useReveal. */
export function useOnScreen<T extends HTMLElement = HTMLDivElement>() {
  const [node, setNode] = useState<T | null>(null)
  const ref = useCallback((el: T | null) => setNode(el), [])

  useEffect(() => {
    if (!node || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => node.classList.toggle('is-onscreen', entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  return ref
}
