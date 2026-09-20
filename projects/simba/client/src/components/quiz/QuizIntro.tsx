import { GiftIcon } from '../icons'
import { useMediaQuery } from '../../hooks/useMediaQuery'

interface QuizIntroProps {
  onStart: () => void
  inModal?: boolean
}

/** Три шага «Как это работает» — только десктоп (hidden lg:block).
    Число вопросов = QUESTIONS_IN_BRANCH в QuizFlow.tsx (8). */
const STEPS = [
  { title: 'Ответьте на 8 вопросов', text: 'Вид, возраст, вес, здоровье и вкусы питомца' },
  { title: 'Получите конкретный корм', text: 'Не бренд, а линейку и вкус — с запасным вариантом' },
  { title: 'Заберите 300 бонусов', text: 'На первую покупку после входа в аккаунт' },
]

export default function QuizIntro({ onStart, inModal }: QuizIntroProps) {
  /** Сцена рендерится только с 1024px: <img> внутри display:none всё равно
      скачивается, а PNG-пара весит ~525 КБ — телефону они не нужны. */
  const showScene = useMediaQuery('(min-width: 1024px)')

  return (
    <div className={`flex items-center justify-center bg-blue-50 px-4 lg:px-8 py-12 lg:py-16 ${
      inModal ? 'min-h-0' : 'min-h-[100dvh]'
    }`}>
      <div className="max-w-2xl lg:max-w-7xl w-full mx-auto text-center lg:text-left">
        <div className="lg:grid lg:grid-cols-12 lg:gap-12 lg:items-center">
          <div className="lg:col-span-6">
            <div className="mb-8">
              <h1 className="text-4xl md:text-5xl lg:text-5xl xl:text-6xl lg:leading-[1.05] lg:text-balance font-bold text-navy-900 mb-4">
                Подберём корм под вашего питомца за пару минут
              </h1>
              <p className="text-lg text-navy-600 mb-6 max-w-prose mx-auto lg:mx-0 lg:max-w-[46ch]">
                Ответим на несколько вопросов о питомце — возраст, вес, здоровье, вкусы. В ответ получите не бренд, а конкретный корм: линейку и вкус.
              </p>
            </div>
            <button onClick={onStart} className="btn-primary px-8 py-4 mb-8 inline-block">Начать подбор</button>
            {/* Ширина текста ограничена, а сам он выровнен влево: иначе подарок повисает у левого края отдельно от фразы. */}
            <div className="bg-white rounded-card border border-line p-6 flex lg:inline-flex items-center justify-center gap-3 mb-8">
              <GiftIcon className="w-6 h-6 flex-shrink-0 text-amber-600" />
              <span className="max-w-[42ch] text-left text-navy-700 font-medium">После подбора — 300 бонусов на первую покупку. Заберёте их после входа в аккаунт</span>
            </div>
            <p className="text-sm text-navy-500">Результат — сразу, без звонков и регистрации.</p>
          </div>

          {/* Сцена: кот (задний план, приглушён) + пёс с миской (передний план). Без transform — под reduced-motion он глобально сброшен. */}
          {showScene && (
            <div className="relative lg:col-span-6 hidden lg:flex items-end justify-center lg:h-[520px] xl:h-[600px]" aria-hidden="true">
              <div className="absolute left-[10%] right-[10%] bottom-2 h-12 rounded-full bg-navy-100/40 blur-2xl" />
              <img src="/pets/cat.png" alt="" width={848} height={1264} loading="eager" decoding="async"
                className="relative z-0 -mr-6 mb-3 w-auto lg:h-[60%] xl:h-[68%] object-contain object-bottom select-none pointer-events-none [filter:saturate(0.92)_contrast(0.97)_brightness(1.02)]" />
              <img src="/pets/smiledog.png" alt="" width={409} height={610} loading="eager" decoding="async"
                className="relative z-10 w-auto lg:h-[80%] xl:h-[88%] object-contain object-bottom select-none pointer-events-none [mask-image:linear-gradient(to_top,transparent_0%,black_6%)]" />
            </div>
          )}
        </div>

        {/* Как это работает — только десктоп */}
        <section className="hidden lg:block mt-16" aria-labelledby="quiz-how-title">
          <h2 id="quiz-how-title" className="text-2xl font-bold text-navy-900 mb-6">Как это работает</h2>
          <ol className="grid grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="bg-white rounded-card border border-line p-6 flex items-start gap-4">
                <span className="w-9 h-9 flex-shrink-0 rounded-full bg-ink text-white text-sm font-semibold inline-flex items-center justify-center tabular-nums" aria-hidden="true">{i + 1}</span>
                <div>
                  <h3 className="text-base font-semibold text-navy-900 leading-snug">{step.title}</h3>
                  <p className="mt-1 text-sm text-navy-500 leading-relaxed">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
