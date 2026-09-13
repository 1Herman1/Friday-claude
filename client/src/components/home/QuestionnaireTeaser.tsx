import { useState } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useReveal } from '../../hooks/useReveal'
import { useDrawer } from '../../context/DrawerContext'
import { useSiteText } from '../../context/SiteTextsContext'
import { GiftIcon } from '../icons'

/** Декор по бокам карточки — новые ассеты с поворотом запечённым.
    Файлы в client/public/decor/. */
const DECOR = [
  { name: 'quiz-left-back', type: 'back' as const, width: 478, height: 861 },
  { name: 'quiz-right-back', type: 'back' as const, width: 537, height: 780 },
  { name: 'paw-front', type: 'front' as const, width: 300, height: 367 },
  { name: 'nose-front', type: 'front' as const, width: 340, height: 361 },
]

function DecorImage({
  name, type, width, height, onReady,
}: (typeof DECOR)[number] & { onReady: () => void }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null

  const side = name.includes('left') ? 'left' : 'right'
  const decorClass = type === 'back'
    ? `quiz-decor quiz-decor--${side}`
    : `quiz-prop ${name.includes('paw') ? 'quiz-prop--paw' : 'quiz-prop--nose'}`

  return (
    <picture>
      <source srcSet={`/decor/${name}.webp`} type="image/webp" />
      <img
        src={`/decor/${name}.png`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        width={width}
        height={height}
        onLoad={onReady}
        onError={() => { setFailed(true); onReady() }}
        className={decorClass}
      />
    </picture>
  )
}

/** Каждая сторона — пара "фон + перед" (кот+лапа, пёс+нос): нос — визуальное
    продолжение морды, поэтому оба грузятся независимо (lazy), но должны
    ПОЯВИТЬСЯ одним кадром, а не по мере готовности каждой картинки —
    иначе видно, как один силуэт возникает раньше другого. */
const SIDES = {
  left: ['quiz-left-back', 'paw-front'],
  right: ['quiz-right-back', 'nose-front'],
} as const

export default function QuestionnaireTeaser() {
  const { openQuiz } = useDrawer()
  const sceneRef = useReveal<HTMLDivElement>({ rootMargin: '0px 0px -25% 0px' })
  const [loaded, setLoaded] = useState<Set<string>>(new Set())

  const quizTitle = useSiteText('home.quiz.title', 'Не знаете, какой корм выбрать?')
  const quizSubtitleOverride = useSiteText('home.quiz.subtitle', '')
  const quizSubtitleDefault = (
    <>
      Несколько вопросов о питомце: возраст, размер, здоровье. Подберём не просто бренд, а{' '}
      <strong className="font-semibold text-navy-700">конкретную линейку и вкус</strong>. Займёт около минуты.
    </>
  )

  /** Показываем декор только на 1280px и выше — вся геометрия выверена на этих ширинах. */
  const showDecor = useMediaQuery('(min-width: 1280px)')

  const markLoaded = (name: string) =>
    setLoaded(prev => (prev.has(name) ? prev : new Set(prev).add(name)))

  const sideReady = (side: keyof typeof SIDES) => SIDES[side].every(name => loaded.has(name))

  return (
    <section id="questionnaire" className="scroll-mt-24 py-12 md:py-16 overflow-x-clip">
      <div className="max-w-7xl mx-auto px-4">
        {/* Якорь для Reveal: сама сцена с карточкой. Четыре декора входят в этот контекст. */}
        <div ref={sceneRef} className="quiz-scene relative mx-auto w-full max-w-4xl">
          {/* Два фоновых декора (кот + пёс) входят первыми — они за карточкой.
              Пара скрыта, пока не готовы ОБЕ картинки её стороны (см. SIDES) —
              появляются одним кадром, без анимации, просто без "проявляется раньше". */}
          {showDecor && DECOR.filter(d => d.type === 'back').map((d) => (
            <div key={d.name} style={{ opacity: sideReady(d.name.includes('left') ? 'left' : 'right') ? 1 : 0 }}>
              <DecorImage {...d} onReady={() => markLoaded(d.name)} />
            </div>
          ))}

          <div className="quiz-card relative z-10 rounded-card bg-white border border-line shadow-card px-5 py-8 md:px-8 md:py-10 text-center">
            <h2 className="text-2xl xl:text-3xl font-bold text-navy-900 mb-3">
              {quizTitle}
            </h2>
            <p className="text-base leading-relaxed text-navy-500 text-pretty max-w-xl mx-auto mb-6">
              {quizSubtitleOverride || quizSubtitleDefault}
            </p>
            <button
              type="button"
              onClick={openQuiz}
              className="btn-primary px-8"
            >
              Подобрать корм
            </button>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-navy-500">
              <GiftIcon className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span><strong className="font-semibold">+300 бонусов</strong> на первую покупку</span>
            </p>
          </div>

          {/* Два передних декора (лапа + нос) входят последними — они поверх карточки. */}
          {showDecor && DECOR.filter(d => d.type === 'front').map((d) => (
            <div key={d.name} style={{ opacity: sideReady(d.name.includes('paw') ? 'left' : 'right') ? 1 : 0 }}>
              <DecorImage {...d} onReady={() => markLoaded(d.name)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
