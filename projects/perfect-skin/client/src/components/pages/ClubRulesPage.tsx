import { Link } from 'react-router-dom'

export function ClubRulesPage() {
  return (
    <div className="container-app py-12 md:py-20">
      <div className="max-w-xl">
        <h1 className="text-h3 md:text-h2 font-heading font-bold text-foreground mb-4 uppercase tracking-tight">
          Правила Бьюти-клуба
        </h1>
        <p className="text-body text-muted-foreground mb-8">Правила программы готовятся. Текст появится на этой странице до запуска клуба.</p>
        <Link to="/orders" className="inline-flex items-center min-h-11 text-sm font-semibold text-primary underline underline-offset-2">
          Вернуться в кабинет
        </Link>
      </div>
    </div>
  )
}
