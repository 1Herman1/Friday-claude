import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="container-app py-12 md:py-24">
      <div className="max-w-prose">
        <h1 className="text-4xl md:text-5xl font-heading font-bold mb-2 text-destructive uppercase">
          404
        </h1>
        <h2 className="text-2xl md:text-3xl font-heading font-bold mb-6 uppercase">
          Страница не найдена
        </h2>
        <p className="text-body font-sans leading-body mb-8 text-muted-foreground">
          Возможно, она была удалена или адрес неправильный.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-pill bg-primary text-primary-foreground font-sans font-semibold hover:opacity-90 transition-opacity duration-200 focus-visible:outline-ring"
          >
            На главную
          </Link>
          <Link
            to="/catalog/all"
            className="inline-flex items-center justify-center px-6 py-3 rounded-pill border border-border text-foreground font-sans font-semibold hover:bg-muted transition-colors duration-200 focus-visible:outline-ring"
          >
            В каталог
          </Link>
        </div>
      </div>
    </div>
  )
}
