import { useEffect, useState } from 'react'
import { bannersApi, type Banner } from '../../lib/api'

/** Медиа-рамка «Кто мы»: баннер со страницы «О нас» из админки, иначе иллюстрация. */
let cache: Banner | null | undefined

export default function AboutBanner() {
  const [banner, setBanner] = useState<Banner | null>(cache ?? null)
  useEffect(() => {
    if (cache !== undefined) return
    let alive = true
    bannersApi.list({ page: 'about', position: 'main_slider' })
      .then((r) => { cache = r.data[0] ?? null })
      .catch(() => { cache = null })
      .finally(() => { if (alive) setBanner(cache ?? null) })
    return () => { alive = false }
  }, [])

  return (
    <div className="rounded-banner overflow-hidden bg-[#D9D9D9] aspect-[16/9] md:aspect-[21/9]">
      {banner ? (
        <picture>
          {banner.imageMobile && <source media="(max-width: 767px)" srcSet={banner.imageMobile} />}
          <img src={banner.image} alt={banner.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        </picture>
      ) : (
        <img src="/pets/dogwithcat.png" alt="Собака и кошка — питомцы Симбы" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      )}
    </div>
  )
}
