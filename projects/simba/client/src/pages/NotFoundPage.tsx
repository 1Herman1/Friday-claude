import { Link } from 'react-router-dom'
import { useMetaTags } from '../hooks/useMetaTags'

export default function NotFoundPage() {
  useMetaTags({
    title: 'Страница не найдена — Зоомагазин Симба',
    description: 'Такой страницы нет. Вернитесь в каталог кормов и товаров для животных.',
    noindex: true,
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
      <h1 className="text-2xl md:text-[32px] font-bold text-navy-900">Такой страницы нет</h1>
      <p className="mt-3 text-navy-500 max-w-prose">
        Возможно, ссылка устарела или в адресе опечатка. Загляните в каталог — там всё, что есть в
        наличии.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Link
          to="/catalog"
          className="btn-primary px-6"
        >
          В каталог
        </Link>
        <Link
          to="/"
          className="btn-primary px-6"
        >
          На главную
        </Link>
      </div>
    </div>
  )
}
