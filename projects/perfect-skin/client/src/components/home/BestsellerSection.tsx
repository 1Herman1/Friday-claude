import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

const products = [
  {
    step: 1,
    video: '/video/2-3.mp4',
    poster: '/video/posters/poster-2-3.jpg',
    name: 'DERMOSUN SPF 50',
    subtitle: 'Солнцезащитный крем',
    price: '3 781 ₽',
    slug: 'dermosun-spf-50-solncezashhitnyj-krem',
  },
  {
    step: 2,
    video: '/video/3-5.mp4',
    poster: '/video/posters/poster-3-5.jpg',
    name: 'O3 DEPUR',
    subtitle: 'Очищающий флюид',
    price: '5 499 ₽',
    slug: 'o3-depur',
  },
  {
    step: 3,
    video: '/video/5-7.mp4',
    poster: '/video/posters/poster-5-7.jpg',
    name: 'TONICO FACIAL EQUILIBRANTE',
    subtitle: 'Балансирующий тоник',
    price: '3 969 ₽',
    slug: 'tonico-facial-equilibrante',
  },
  {
    step: 4,
    video: '/video/7-9.mp4',
    poster: '/video/posters/poster-7-9.jpg',
    name: 'FLUIDO VISCOSO FORTE',
    subtitle: 'Активный флюид',
    price: '5 999 ₽',
    slug: 'fluido-viscoso-forte',
  },
]

export function BestsellerSection() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [activeStep, setActiveStep] = useState(1)
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  // Respect prefers-reduced-motion
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  useEffect(() => {
    // Desktop: IntersectionObserver for scroll-pinning
    if (isMobile || prefersReducedMotion) return

    const observerOptions = {
      threshold: 0.5,
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const stepStr = (entry.target as HTMLElement).dataset.step
        if (!stepStr) return

        const step = parseInt(stepStr, 10)

        if (entry.isIntersecting) {
          setActiveStep(step)

          // Play video for this step
          const video = videoRefs.current[step]
          if (video) {
            video.currentTime = 0
            // Play only if not already playing
            if (video.paused) {
              video.play().catch(() => {
                // Silent fail if autoplay blocked
              })
            }
          }
        } else {
          // Pause video when out of view
          const video = videoRefs.current[step]
          if (video && !video.paused) {
            video.pause()
          }
        }
      })
    }, observerOptions)

    // Observe all step divs
    products.forEach((product) => {
      const ref = stepRefs.current[product.step]
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [isMobile, prefersReducedMotion])

  // Mobile: no pinning, vertical stack with video play on scroll
  if (isMobile) {
    return (
      <section className="bg-background py-12 md:py-20">
        <div className="container-app">
          <h2 className="text-h2 font-heading font-bold mb-3 md:mb-16">
            Бестселлеры
          </h2>

          <div className="space-y-12">
            {products.map((product) => (
              <MobileStep
                key={product.step}
                product={product}
                videoRef={(el) => {
                  videoRefs.current[product.step] = el
                }}
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  // Desktop: scroll-pinned section (500vh height)
  return (
    <section
      ref={containerRef}
      className="bg-background relative"
      style={{ height: prefersReducedMotion ? 'auto' : '500vh' }}
    >
      {/* Sticky container */}
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        <div className="container-app">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6 items-center">
            {/* LEFT: Title + Steps */}
            <div>
              <h2 className="text-h2 font-heading font-bold mb-3 md:mb-16">
                Бестселлеры
              </h2>

              {/* Steps markers */}
              <div className="flex gap-2 mb-16 md:mb-20">
                {products.map((product) => (
                  <div
                    key={product.step}
                    className={`
                      w-3 h-3 rounded-full transition-[background-color,transform] duration-300
                      ${
                        activeStep === product.step
                          ? 'bg-primary scale-125'
                          : 'bg-border'
                      }
                    `}
                  />
                ))}
              </div>

              {/* Product info for active step */}
              {products.map((product) => (
                <div
                  key={product.step}
                  className={`
                    transition-opacity duration-300
                    ${activeStep === product.step ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                  `}
                >
                  <h3 className="text-h3 font-heading font-bold mb-2">
                    {product.name}
                  </h3>
                  <p className="text-body text-muted-foreground mb-6">
                    {product.subtitle}
                  </p>
                  <div className="text-price font-heading font-bold text-foreground mb-2">
                    {product.price}
                  </div>
                  <a
                    href={`/product/${product.slug}`}
                    className="inline-block bg-primary text-primary-foreground font-heading font-bold px-6 py-3 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11"
                  >
                    Подробнее
                  </a>
                </div>
              ))}
            </div>

            {/* RIGHT: Video */}
            <div className="relative aspect-[3/4] md:aspect-auto md:h-screen md:-my-24 flex items-center">
              {products.map((product) => (
                <video
                  key={product.step}
                  ref={(el) => {
                    videoRefs.current[product.step] = el
                  }}
                  src={product.video}
                  poster={product.poster}
                  muted
                  playsInline
                  className={`
                    absolute w-full h-full object-cover rounded-block
                    transition-opacity duration-500
                    ${activeStep === product.step ? 'opacity-100' : 'opacity-0'}
                  `}
                  preload={activeStep === product.step ? 'metadata' : 'none'}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Invisible triggers for scroll observer */}
        <div className="absolute inset-0 pointer-events-none">
          {products.map((product) => (
            <div
              key={product.step}
              ref={(el) => {
                stepRefs.current[product.step] = el
              }}
              data-step={product.step}
              className="absolute left-0 right-0"
              style={{
                top: `${(product.step - 1) * (100 / 4)}vh`,
                height: '25vh',
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function MobileStep({
  product,
  videoRef,
}: {
  product: (typeof products)[0]
  videoRef: (el: HTMLVideoElement | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const video = containerRef.current?.querySelector('video') as HTMLVideoElement
          if (video && video.paused) {
            video.play().catch(() => {
              // Silent fail
            })
          }
        } else {
          const video = containerRef.current?.querySelector('video') as HTMLVideoElement
          if (video && !video.paused) {
            video.pause()
          }
        }
      },
      { threshold: 0.5 }
    )

    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="space-y-6"
    >
      <video
        ref={videoRef}
        src={product.video}
        poster={product.poster}
        muted
        playsInline
        className="w-full h-auto rounded-block"
        preload="none"
      />
      <div>
        <h3 className="text-h3 font-heading font-bold mb-2">
          {product.name}
        </h3>
        <p className="text-body text-muted-foreground mb-4">
          {product.subtitle}
        </p>
        <div className="text-price font-heading font-bold text-foreground mb-6">
          {product.price}
        </div>
        <a
          href={`/product/${product.slug}`}
          className="inline-block bg-foreground text-card font-heading font-bold px-6 py-3 rounded-pill transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-11"
        >
          Подробнее
        </a>
      </div>
    </div>
  )
}
