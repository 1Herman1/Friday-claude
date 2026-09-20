import { PawIcon } from './icons'

type Props = { className?: string }

/** Заглушка обложки статьи без картинки — тот же набор, что у товара без фото
    (PawIcon на нейтральной подложке), а не синий тинт с иконкой «картинка».
    Фон задаётся снаружи: в карточках — blue-50, на странице статьи (где фон
    страницы сам blue-50) — белый с рамкой, иначе заглушка сливается с фоном. */
export default function BlogCoverFallback({ className = 'aspect-[16/10] bg-blue-50' }: Props) {
  return (
    <div className={`w-full flex items-center justify-center text-navy-200 ${className}`} aria-hidden="true">
      <PawIcon className="w-16 h-16" />
    </div>
  )
}
