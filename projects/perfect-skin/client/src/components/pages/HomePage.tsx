import { HeroSection } from '@/components/home/HeroSection'
import { CtaTiles } from '@/components/home/CtaTiles'
import { BrandsSection } from '@/components/home/BrandsSection'
import { CategoryAccordion } from '@/components/home/CategoryAccordion'
import { BestsellerSection } from '@/components/home/BestsellerSection'
import { WhyHeberFarma } from '@/components/home/WhyHeberFarma'
import { About } from '@/components/home/About'
import { useDrawer } from '@/context/DrawerContext'

export function HomePage() {
  const { openQuiz } = useDrawer()
  return (
    <>
      {/* Hero */}
      <HeroSection />

      {/* CTA Tiles: Подбор и Консультация */}
      <CtaTiles />

      {/* Quiz Teaser */}
      <section id="quiz-teaser" className="bg-card rounded-block py-12 md:py-16 px-6 md:px-10 my-20 md:my-32 mx-auto max-w-3xl">
        <h2 className="text-h2 font-heading font-bold mb-4 text-foreground">
          Подбор ухода за 5 вопросов
        </h2>
        <p className="text-body leading-body text-muted-foreground mb-6">
          Ответьте на пять вопросов — соберём программу под ваш тип кожи.
        </p>
        <button
          onClick={openQuiz}
          className="inline-flex items-center justify-center bg-primary text-primary-foreground font-heading font-bold px-6 py-3 rounded-pill hover:opacity-90 transition-opacity duration-200 min-h-11"
        >
          Начать подбор
        </button>
      </section>

      {/* Brands */}
      <BrandsSection />

      {/* Categories */}
      <CategoryAccordion />

      {/* Bestsellers */}
      <BestsellerSection />

      {/* Why Heber Farma */}
      <WhyHeberFarma />

      {/* About */}
      <About />
    </>
  )
}
