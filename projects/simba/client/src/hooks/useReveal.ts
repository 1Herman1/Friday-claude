import { useCallback, useEffect, useState } from 'react'

/**
 * Однократный scroll-reveal через IntersectionObserver.
 * Добавляет класс `is-visible`, когда элемент входит во вьюпорт, и отписывается.
 * При reduced-motion или отсутствии IO — показывает сразу, без анимации.
 *
 * Callback-ref, а не useRef: если компонент на первом рендере возвращает
 * null (например, ждёт данные с сервера — как BrandsSection до ответа API),
 * элемент с ref физически не существует в DOM в момент монтирования. Эффект
 * с обычным useRef + [] запускается один раз и видит ref.current === null
 * навсегда — обсервер не подключается, даже когда элемент появляется позже.
 * Callback-ref обновляет state при каждом реальном mount/unmount узла, эффект
 * зависит от этого state и переустанавливает наблюдатель на актуальный узел.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: { rootMargin?: string }) {
  const [node, setNode] = useState<T | null>(null)
  const rootMargin = options?.rootMargin ?? '0px 0px -12% 0px'

  const ref = useCallback((el: T | null) => {
    setNode(el)
  }, [])

  useEffect(() => {
    if (!node) return

    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      node.classList.add('is-visible')
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        }
      },
      // threshold: 0 — старт не зависит от высоты секции. С прежними 0.15
      // порог считался от площади элемента: короткие секции вспыхивали сразу,
      // высокие — заметно позже, ритм плавал. Плюс секция выше ~6 вьюпортов
      // никогда не набирала 15% и оставалась скрытой.
      { threshold: 0, rootMargin }
    )

    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node])

  return ref
}
