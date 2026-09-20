import { HeroSection } from '@/components/home/HeroSection'
import { CtaTiles } from '@/components/home/CtaTiles'
import { BrandsSection } from '@/components/home/BrandsSection'
import { CategoryAccordion } from '@/components/home/CategoryAccordion'
import { BestsellerSection } from '@/components/home/BestsellerSection'
import { ProSection } from '@/components/home/ProSection'
import { About } from '@/components/home/About'

export function HomePage() {
  return (
    <>
      {/* Hero */}
      <HeroSection />

      {/* CTA Tiles: Подбор и Консультация */}
      <CtaTiles />

      {/* Brands */}
      <BrandsSection />

      {/* Categories */}
      <CategoryAccordion />

      {/* Bestsellers */}
      <BestsellerSection />

      {/* Pro Section */}
      <ProSection />

      {/* About */}
      <About />
    </>
  )
}
