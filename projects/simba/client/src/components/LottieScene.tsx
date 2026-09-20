import { useEffect, useRef, useState } from 'react'

type Props = {
  /** Динамический импорт JSON: сцена не должна попадать в основной бандл. */
  load: () => Promise<{ default: unknown }>
  className?: string
  /** true — вечная петля; число — сколько ДОПОЛНИТЕЛЬНЫХ проходов после первого
      (loop={1} = два прохода и стоп). По умолчанию петля: владелец решил, что
      обе сцены крутятся постоянно. Прежний довод против петли в пустом каталоге
      — движение рядом с единственной кнопкой отбирает внимание — остаётся в
      силе как соображение, но решение принято в пользу петли. */
  loop?: boolean | number
}

/**
 * Проигрыватель Lottie для двух сцен-иллюстраций.
 *
 * Общий, а не по копии на сцену: логика загрузки рантайма, отмены и уборки
 * плеера пишется один раз. Девять копий одного спиннера в этом проекте уже
 * разъехались — повторять не хочется.
 *
 * Плеер и данные грузятся динамически, поэтому в основной бандл не попадают:
 * платят за них только те, кто открыл пустой каталог или запустил подбор.
 *
 * При prefers-reduced-motion анимация не запускается — показывается первый кадр.
 * Если рантайм не загрузился, компонент просто ничего не рисует: экран, на
 * котором он стоит, обязан оставаться рабочим и без картинки.
 */
export default function LottieScene({ load, className = '', loop = true }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let destroy: (() => void) | undefined
    let cancelled = false

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    Promise.all([import('lottie-web/build/player/lottie_light'), load()])
      .then(([lottie, data]) => {
        if (cancelled || !hostRef.current) return
        const player = lottie.default.loadAnimation({
          container: hostRef.current,
          renderer: 'svg',
          loop,
          autoplay: !reduced,
          animationData: data.default,
        })
        if (reduced) player.goToAndStop(0, true)
        destroy = () => player.destroy()
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      destroy?.()
    }
  }, [load, loop])

  if (failed) return null
  return <div ref={hostRef} className={`lottie-host ${className}`} aria-hidden="true" />
}
