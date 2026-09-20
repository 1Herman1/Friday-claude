import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import LottieScene from '../LottieScene'


type Props = {
  /** true — раздел ещё наполняется; false — под фильтры покупателя ничего не нашлось. */
  sectionEmpty: boolean
}

const delay = (ms: number) => ({ '--in-delay': `${ms}ms` }) as CSSProperties

export default function EmptyCatalog({ sectionEmpty }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className={`empty-in text-center py-16 ${mounted ? 'is-in' : ''}`}>
      {/* Тень под лапами: в файле её нет, а обе прежние сцены анкерились
          наземным эллипсом — без него пёс висит в воздухе и выпадает из ряда.
          Статическая: в плоской иллюстрации тень не ездит. */}
      <div className="empty-scene relative w-32 mx-auto mb-6">
        <LottieScene
          load={() => import('../../lottie/empty-catalog.json')}
          className="w-full aspect-[1065/922]"
        />
        <svg viewBox="0 0 100 8" aria-hidden="true" focusable="false"
          className="absolute inset-x-0 bottom-[3%] w-[76%] mx-auto">
          <ellipse cx="50" cy="4" rx="50" ry="4" className="fill-navy-100" />
        </svg>
      </div>
      <h2 className="text-navy-900 text-2xl font-bold mb-2" style={delay(25)}>
        {sectionEmpty ? 'Этот раздел мы сейчас наполняем' : 'Ничего не нашлось'}
      </h2>
      <p className="text-navy-500 text-base mb-8 max-w-prose mx-auto" style={delay(25)}>
        {sectionEmpty
          ? 'Товары появятся здесь в ближайшее время. А пока загляните в корма — там больше пятисот позиций.'
          : 'Попробуйте другой запрос или снимите часть фильтров.'}
      </p>
      <Link to="/catalog" className="btn-primary px-6" style={delay(50)}>
        Весь каталог
      </Link>
    </div>
  )
}
