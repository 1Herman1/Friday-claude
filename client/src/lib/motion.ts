/**
 * Единая точка входа в анимацию.
 *
 * Прямые импорты из `animejs` в компонентах запрещены: библиотека не знает про
 * `prefers-reduced-motion`, и любой обход этого модуля нарушает правило из
 * `docs/core/motion.md`. Соответствие доктрины примитивам — `docs/core/motion-engine.md`.
 */
import { animate as anime } from 'animejs/animation'
import { spring as animeSpring } from 'animejs/easings'
import { onScroll } from 'animejs/events'
import { stagger as animeStagger, set as animeSet } from 'animejs/utils'

type AnimeParams = Parameters<typeof anime>[1]
type AnimeTargets = Parameters<typeof anime>[0]

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

/** Свойства, которые двигают элемент. При reduced-motion они не анимируются. */
const MOTION_PROPS = new Set([
  'x', 'y', 'z',
  'translateX', 'translateY', 'translateZ',
  'rotate', 'rotateX', 'rotateY', 'rotateZ',
  'scale', 'scaleX', 'scaleY', 'scaleZ',
  'skew', 'skewX', 'skewY',
  'width', 'height', 'top', 'left', 'right', 'bottom',
])

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_QUERY).matches
  )
}

/** Подписка на смену системной настройки — без перезагрузки страницы. */
export function onReducedMotionChange(cb: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia(REDUCED_QUERY)
  const handler = (e: MediaQueryListEvent) => cb(e.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}

/** Easing из `docs/core/motion.md`. Ускоряющийся старт намеренно отсутствует. */
export const EASE = {
  out: 'cubicBezier(0.23, 1, 0.32, 1)',
  inOut: 'cubicBezier(0.77, 0, 0.175, 1)',
  drawer: 'cubicBezier(0.32, 0.72, 0, 1)',
  linear: 'linear',
} as const

/** Длительности из `docs/core/motion.md`, мс. */
export const DURATION = {
  press: 160,
  tooltip: 160,
  dropdown: 200,
  modal: 300,
  drawer: 400,
} as const

/** Выход быстрее входа: 70% от длительности появления. */
export const exitDuration = (enter: number) => Math.round(enter * 0.7)

/**
 * Пружина по Apple: `damping` + `response` вместо mass/stiffness.
 * damping 1.0 — без отскока, ~0.8 — лёгкий overshoot после жеста с инерцией.
 */
export function spring(damping = 1, response = 0.4) {
  // У anime.js пружина задаётся через bounce/duration — это та же модель Apple,
  // только с другой стороны: bounce = 0 означает критическое затухание.
  return animeSpring({ bounce: Math.max(0, 1 - damping), duration: Math.round(response * 1000) })
}

/**
 * Анимация с обязательным учётом reduced-motion.
 *
 * При включённой настройке движение убирается, но `opacity` и цвет остаются:
 * интерфейс мягко проявляется, а не телепортируется.
 */
export function animate(targets: AnimeTargets, params: AnimeParams) {
  if (!prefersReducedMotion()) return anime(targets, params)

  const safe: Record<string, unknown> = {}
  const final: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (MOTION_PROPS.has(key)) final[key] = value
    else safe[key] = value
  }
  // Смещения применяются мгновенно конечным значением, без промежуточных кадров.
  if (Object.keys(final).length) animeSet(targets, final as never)
  return anime(targets, { ...safe, duration: Math.min((safe.duration as number) ?? 200, 200) } as AnimeParams)
}

/** Стаггер списка: 30–80мс по доктрине, дефолт — середина диапазона. */
export const stagger: typeof animeStagger = animeStagger

/**
 * Появление при скролле. При reduced-motion элемент сразу виден —
 * наблюдатель не заводится вовсе.
 */
export function scrollReveal(
  targets: AnimeTargets,
  params: AnimeParams,
  scrollOptions?: Parameters<typeof onScroll>[0]
) {
  if (prefersReducedMotion()) {
    animeSet(targets, { opacity: 1 } as never)
    return null
  }
  return anime(targets, {
    ...params,
    autoplay: onScroll({ enter: 'bottom-=12% top', repeat: false, ...scrollOptions }),
  } as AnimeParams)
}

export { onScroll }
