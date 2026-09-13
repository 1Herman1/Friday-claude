import { type ReactNode } from 'react'
import BannerCarousel from '../components/home/BannerCarousel'
import QuestionnaireTeaser from '../components/home/QuestionnaireTeaser'
import CategoryTiles from '../components/home/CategoryTiles'
import AdvantagesSection from '../components/home/AdvantagesSection'
import PopularProducts from '../components/PopularProducts'
import BrandsSection from '../components/home/BrandsSection'
import AboutSection from '../components/home/AboutSection'
import ReviewsSection from '../components/home/ReviewsSection'
import FaqSection from '../components/home/FaqSection'
import TrustSection from '../components/home/TrustSection'
import BlogSection from '../components/home/BlogSection'
import { useReveal } from '../hooks/useReveal'
import { useMetaTags } from '../hooks/useMetaTags'

/** Оборачивает секцию в scroll-reveal (fade + подъём 16px). Баннер не оборачиваем — он над сгибом. */
function Reveal({ children }: { children: ReactNode }) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className="reveal">
      {children}
    </div>
  )
}

export default function HomePage() {
  useMetaTags({
    title: 'Симба — зоомагазин: корм для кошек и собак с доставкой',
    description:
      'Оригинальные корма Farmina, Monge, Royal Canin для кошек и собак. Подбор корма под питомца, доставка, бонусная программа. Прямые поставки от официальных дистрибьюторов.',
  })

  return (
    <div>
      {/* Постоянный H1 страницы: заголовки баннера ротируются и на эту роль не годятся. */}
      <h1 className="sr-only">Зоомагазин Симба — корм для кошек и собак с доставкой</h1>
      <BannerCarousel />
      {/* Секция квиза теперь имеет свой useReveal и наблюдатель — не оборачиваем */}
      <QuestionnaireTeaser />
      <Reveal><CategoryTiles /></Reveal>
      <Reveal><AdvantagesSection /></Reveal>
      <PopularProducts variant="home" />
      {/* Без <Reveal>: у секции собственный каскад .reveal-group */}
      <BrandsSection />
      <AboutSection />
      <Reveal><ReviewsSection /></Reveal>
      <Reveal><FaqSection /></Reveal>
      <Reveal><TrustSection /></Reveal>
      {/* Без <Reveal>: у секции собственный каскад .reveal-group */}
      <BlogSection />
    </div>
  )
}
