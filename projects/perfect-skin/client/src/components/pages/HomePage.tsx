import { useEffect } from 'react'
import { hasDemoParam } from '@/lib/demo-mode'
import { HeroSection } from '@/components/home/HeroSection'
import { CtaTiles } from '@/components/home/CtaTiles'
import { BrandsSection } from '@/components/home/BrandsSection'
import { CategoryAccordion } from '@/components/home/CategoryAccordion'
import { BestsellerScene } from '@/components/home/BestsellerScene'
import { PopularSection } from '@/components/home/PopularSection'
import { VideoReviewsSection } from '@/components/home/VideoReviewsSection'
import { ProSection } from '@/components/home/ProSection'
import { AboutHome } from '@/components/home/AboutHome'
import { BlogSection } from '@/components/home/BlogSection'
import { NewsSection } from '@/components/home/NewsSection'
import { FaqSection } from '@/components/home/FaqSection'

export function HomePage() {
  useEffect(() => {
    if (!hasDemoParam()) return
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.append(robots)
    return () => robots.remove()
  }, [])

  return (
    <>
      {/* Hero */}
      <HeroSection />

      {/* Brands */}
      <BrandsSection />

      {/* Categories */}
      <CategoryAccordion />

      {/* Bestsellers Scrollytelling Scene */}
      <BestsellerScene />

      {/* Popular: сетка, которой управляет клиент */}
      <PopularSection />

      {/* CTA: подбор ухода и консультация */}
      <CtaTiles />

      {/* Video reviews */}
      <VideoReviewsSection />

      {/* Pro Section */}
      <ProSection />

      {/* About */}
      <AboutHome />

      {/* Journal: статьи и новости */}
      <BlogSection />
      <NewsSection />

      {/* FAQ */}
      <FaqSection />
    </>
  )
}
