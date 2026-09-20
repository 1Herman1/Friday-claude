import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="container-app py-12 md:py-24">
      <div className="max-w-prose">
        <h1 className="text-display font-heading font-bold mb-2 text-destructive">
          404
        </h1>
        <p className="text-h2 font-heading font-bold mb-6">
          Страница не найдена
        </p>
        <p className="text-body font-sans leading-body mb-2 text-muted-foreground">
          Возможно, она была удалена или адрес неправильный.
        </p>
        <Link
          to="/"
          className="inline-block px-24 py-12 rounded-pill bg-primary text-primary-foreground font-sans font-semibold hover:opacity-90 transition-opacity duration-200 focus-visible:outline-ring"
        >
          На главную
        </Link>
      </div>
    </div>
  )
}
