import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon } from '../icons'
import { useMediaQuery } from '../../hooks/useMediaQuery'

export type CatalogTagSpecies = 'cat' | 'dog'

/* species — чип имеет смысл только для этого вида: «Для щенков» в кошачьем
   каталоге давал пустую выдачу, потому что вид и возраст складываются через И. */
export const CATALOG_TAGS: Array<{ id: string; label: string; species?: CatalogTagSpecies }> = [
  { id: 'kidney', label: 'При болезнях почек' },
  { id: 'allergy', label: 'Без аллергенов' },
  { id: 'kitten', label: 'Для котят', species: 'cat' },
  { id: 'puppy', label: 'Для щенков', species: 'dog' },
  { id: 'weight', label: 'Контроль веса' },
  { id: 'urinary', label: 'Мочекаменная' },
  { id: 'digestion', label: 'Пищеварение' },
  { id: 'senior', label: 'Пожилые питомцы' },
  { id: 'grain-free', label: 'Без зерна' },
  { id: 'holistic', label: 'Холистик' },
]

interface Props {
  activeTag: string
  onTagClick: (tag: string) => void
  /** Текущий вид в каталоге; чипы другого вида скрываются. */
  species?: string
}

export function tagFitsSpecies(tag: { species?: CatalogTagSpecies }, species?: string): boolean {
  return !tag.species || !species || tag.species === species
}

/** Ширина растушёвки у края: чуть больше кнопки (36px), чтобы она целиком стояла
    внутри затухания — иначе её край читается как обрез вёрстки, а не как «чип
    уходит под кнопку». */
const FADE = 44

function maskFor(left: boolean, right: boolean): string | undefined {
  if (!left && !right) return undefined
  const stops = [
    left ? `transparent 0, black ${FADE}px` : 'black 0',
    right ? `black calc(100% - ${FADE}px), transparent 100%` : 'black 100%',
  ]
  return `linear-gradient(to right, ${stops.join(', ')})`
}

/** Ряд быстрых фильтров — одна строка со стрелками-листалками.
 *
 *  Десять вкладок требуют ~1296px при доступных 1248px, поэтому последняя
 *  («Холистик») не помещается. Мышью её было не достать: полоса прокрутки
 *  скрыта, а колесо по горизонтали не прокручивает. Стрелки решают это, не
 *  занимая вторую строку в липкой шапке (перенос стоил бы 46px высоты).
 *
 *  Стрелки НАКЛАДЫВАЮТСЯ на края, а не стоят рядом: ряду не хватает всего ~48px,
 *  и кнопки сбоку отняли бы ещё ~90px ширины, то есть сделали бы хуже.
 *
 *  Показываются только при мыши: именно мышиные пользователи не могут прокрутить
 *  ряд. На тач-экране свайп естественен, и стрелки там лишь закрывали бы чипы.
 */
export default function CatalogTags({ activeTag, onTagClick, species }: Props) {
  const visibleTags = CATALOG_TAGS.filter(tag => tagFitsSpecies(tag, species))
  const trackRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')

  const syncArrows = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < max - 4)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    syncArrows()

    // Первый замер идёт на системном шрифте: Nunito подключён с display=swap,
    // и после подмены ширины чипов меняются. Переполнение здесь ~48px — меньше
    // разницы метрик двух шрифтов, поэтому без пересчёта стрелка могла не
    // появиться там, где листать есть что.
    document.fonts?.ready.then(syncArrows).catch(() => {})

    el.addEventListener('scroll', syncArrows, { passive: true })
    // ResizeObserver, а не window.resize: ловит и смену ширины контейнера
    // без изменения размера окна.
    const ro = new ResizeObserver(syncArrows)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', syncArrows)
      ro.disconnect()
    }
  }, [syncArrows])

  /** Листаем на 60% видимой ширины: у чипов разная ширина, шаг «на один чип»
      был бы то незаметным, то через весь экран. */
  const scrollByPage = (direction: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: direction * el.clientWidth * 0.6, behavior: reduce ? 'auto' : 'smooth' })
  }

  /** inset-y-0 my-auto, а не top-1/2 -translate-y-1/2: глобальное правило
      prefers-reduced-motion гасит transform у всего через `!important`, и
      трансформ-центрирование там разъезжается — кнопка вылезала из шапки. */
  const arrowClass =
    'btn-press absolute inset-y-0 my-auto z-10 w-9 h-9 rounded-full bg-white border border-line flex items-center justify-center text-navy-700 hover:border-ink shadow-card transition-opacity'

  /** Неактивная стрелка гасится, а не размонтируется: иначе после долистывания
      узел исчезает вместе с фокусом клавиатуры, и следующий Tab начинает обход
      страницы заново. */
  const arrowState = (enabled: boolean) =>
    enabled ? 'opacity-100' : 'opacity-0 pointer-events-none'

  return (
    <div className="relative">
      {/* Левая стрелка стоит в разметке ДО ряда: порядок Tab должен совпадать
          с визуальным, а визуально она первая. */}
      {finePointer && (
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label="Предыдущие фильтры"
          tabIndex={canScrollLeft ? 0 : -1}
          aria-hidden={!canScrollLeft}
          className={`${arrowClass} left-0 ${arrowState(canScrollLeft)}`}
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
      )}

      <div
        ref={trackRef}
        role="group"
        aria-label="Быстрые фильтры"
        style={{
          maskImage: maskFor(canScrollLeft, canScrollRight),
          WebkitMaskImage: maskFor(canScrollLeft, canScrollRight),
        }}
        // py-1/-mx-1 px-1 — место под кольцо фокуса: overflow-x: auto делает и
        // overflow-y: auto, иначе обводка обрезалась бы сверху.
        className="flex gap-2 -mx-1 px-1 py-1 overflow-x-auto scrollbar-hide"
      >
        {visibleTags.map(tag => (
          <button
            key={tag.id}
            type="button"
            onClick={() => onTagClick(tag.id)}
            aria-pressed={activeTag === tag.id}
            // Активная вкладка заливается, а не остаётся белой с цветной рамкой:
            // у прежнего активного класса не было ширины рамки (только цвет), из-за
            // чего вкладка при клике теряла 2px и весь ряд дёргался. Плюс белый чип
            // на белой шапке читался как «рамка отвалилась», а не как «выбрано».
            className={`btn-press flex-shrink-0 inline-flex items-center min-h-11 lg:min-h-0 px-4 py-2 rounded-full text-sm font-medium ${
              activeTag === tag.id
                ? 'bg-ink border border-ink text-white'
                : 'bg-white border border-line text-navy-700 [@media(hover:hover)]:hover:bg-ink [@media(hover:hover)]:hover:border-ink [@media(hover:hover)]:hover:text-white'
            }`}>
            {tag.label}
          </button>
        ))}
      </div>

      {finePointer && (
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label="Следующие фильтры"
          tabIndex={canScrollRight ? 0 : -1}
          aria-hidden={!canScrollRight}
          className={`${arrowClass} right-0 ${arrowState(canScrollRight)}`}
        >
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

/** Человеческое название фильтра для заголовка страницы. */
export function catalogTagLabel(id: string): string {
  return CATALOG_TAGS.find(t => t.id === id)?.label ?? id
}
