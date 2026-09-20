import { useEffect, useRef, useState } from 'react'

export function About() {
  const [counter, setCounter] = useState(0)
  const counterRef = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          let current = 0
          const interval = setInterval(() => {
            current += 1
            setCounter(current)
            if (current >= 9) clearInterval(interval)
          }, 100)
        }
      },
      { threshold: 0.5 }
    )

    if (counterRef.current) observer.observe(counterRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="about" className="bg-background py-20 md:py-32">
      <div className="container-app">
        <div className="max-w-prose mb-16 md:mb-24">
          <h2 className="text-h2 font-heading font-bold mb-6">О компании</h2>
          <p className="text-body leading-body text-foreground mb-6">
            Perfect Skin — официальный дистрибьютор испанского фармацевтического
            концерна Heber Farma на территории России и стран СНГ.
          </p>
          <p className="text-body leading-body text-muted-foreground">
            Мы предлагаем две премиум-линейки косметики для профессионалов и
            домашнего ухода: ISSEIMI с активными концентратами и GLACÉE с
            европейским качеством.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-6">
          {/* Counter: 9 лет */}
          <div ref={counterRef} className="flex flex-col">
            <div className="text-display font-heading font-bold text-foreground mb-2">
              {counter}+
            </div>
            <p className="text-body-sm text-muted-foreground">
              Лет на рынке
            </p>
          </div>

          {/* Static: 40+ */}
          <div className="flex flex-col">
            <div className="text-display font-heading font-bold text-foreground mb-2">
              40+
            </div>
            <p className="text-body-sm text-muted-foreground">
              Стран-партнёров
            </p>
          </div>

          {/* Badge: Официальный */}
          <div className="flex flex-col items-start">
            <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-1 py-0.5 rounded-pill mb-4 text-body-sm font-bold">
              ✓ Официальный
            </div>
            <p className="text-body-sm text-muted-foreground">
              Дистрибьютор с 2017
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
