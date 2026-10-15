// Заглушка сетки из 4 карточек, пока товары грузятся: место под сетку занято, ниже ничего не прыгает
export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card rounded-block overflow-hidden">
          <div className="w-full h-64 bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="p-5 space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse motion-reduce:animate-none w-1/2" />
            <div className="h-5 bg-muted rounded animate-pulse motion-reduce:animate-none" />
            <div className="h-4 bg-muted rounded animate-pulse motion-reduce:animate-none w-1/3" />
            <div className="h-11 bg-muted rounded-pill animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  )
}
