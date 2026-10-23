import { Link } from 'react-router-dom'
import { fetchPublicPosts, type PublicPostListItem } from '@/lib/admin-api'
import { formatPostDate } from '@/lib/format'
import { isDemoSections } from '@/lib/demo-mode'
import { useHomeList } from '@/hooks/useHomeList'
import { LABEL } from '@/components/about/classes'
import { PostAdNote } from '@/components/blog/PostAdNote'
import { MoreLink } from '@/components/home/SectionHeader'
import { IconArrowRight } from '@/components/icons'

const MIN_NEWS = 2
const MAX_NEWS = 4
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

async function loadNews(): Promise<PublicPostListItem[]> {
  if (import.meta.env.DEV && isDemoSections()) return (await import('@/lib/home-demo')).DEMO_NEWS
  return (await fetchPublicPosts({ kind: 'news', limit: MAX_NEWS })).items
}

function NewsRow({ item, withCover }: { item: PublicPostListItem; withCover: boolean }) {
  const columns = withCover
    ? 'grid-cols-[4rem_minmax(0,1fr)] md:grid-cols-[5rem_minmax(0,1fr)_auto]'
    : 'grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_auto]'
  return (
    <li>
      <Link
        to={`/blog/${item.slug}`}
        className={`group grid ${columns} items-center gap-4 py-4 min-h-11 rounded-media focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
      >
        {withCover && item.coverImage && (
          <img
            src={item.coverImage}
            alt=""
            width={160}
            height={160}
            loading="lazy"
            decoding="async"
            className="size-16 md:size-20 rounded-media object-cover"
          />
        )}
        <div className="min-w-0">
          <time dateTime={item.publishedAt} className={`${LABEL} text-muted-foreground`}>
            {formatPostDate(item.publishedAt)}
          </time>
          <h3 className="mt-1 font-heading text-body md:text-[1.125rem] font-semibold leading-[1.3] line-clamp-2 group-hover:underline underline-offset-4 decoration-1">
            {item.title}
          </h3>
          {item.excerpt && (
            <p className="hidden md:mt-1 md:line-clamp-1 text-body-sm leading-body text-muted-foreground">{item.excerpt}</p>
          )}
          <PostAdNote isAd={item.isAd} advertiser={item.advertiser} erid={item.erid} className="mt-1" />
        </div>
        <IconArrowRight
          size={20}
          className="hidden md:block text-primary transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        />
      </Link>
    </li>
  )
}

export function NewsSection() {
  const items = useHomeList(loadNews)
  if (!items || items.length < MIN_NEWS) return null
  // Список отсортирован по publishedAt desc: первая новость — самая свежая
  if (Date.now() - new Date(items[0].publishedAt).getTime() > MAX_AGE_MS) return null

  const list = items.slice(0, MAX_NEWS)
  // Миниатюры — всё или ничего: рваный столбец картинок хуже списка без них
  const withCover = list.every((item) => item.coverImage)

  return (
    <section
      aria-labelledby="home-news-title"
      data-home="news"
      className="bg-background py-10 md:py-14 [[data-home=blog]+&]:pt-0"
    >
      <div className="container-app">
        <div className="rounded-block bg-card p-6 md:p-8 xl:p-12 lg:grid lg:grid-cols-12 lg:gap-6">
          <header className="lg:col-span-4">
            <h2 id="home-news-title" className="text-h3 [text-wrap:balance]">
              Новости
            </h2>
            <p className="mt-3 max-w-[32ch] text-body-sm leading-body text-muted-foreground">
              Поступления, акции и изменения в работе магазина.
            </p>
            <MoreLink to="/blog?kind=news" className="mt-2 lg:mt-6">
              Все новости
            </MoreLink>
          </header>
          <ul className="mt-2 -mb-4 divide-y divide-border lg:col-span-8 lg:-mt-4">
            {list.map((item) => (
              <NewsRow key={item.id} item={item} withCover={withCover} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
