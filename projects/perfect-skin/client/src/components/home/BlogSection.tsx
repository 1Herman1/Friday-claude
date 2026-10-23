import { Link } from 'react-router-dom'
import { fetchPublicPosts, type PublicPostListItem } from '@/lib/admin-api'
import { formatPostDate } from '@/lib/format'
import { isDemoSections } from '@/lib/demo-mode'
import { useHomeList } from '@/hooks/useHomeList'
import { LABEL } from '@/components/about/classes'
import { PostAdNote } from '@/components/blog/PostAdNote'
import { SectionHeader } from '@/components/home/SectionHeader'

const POSTS_COUNT = 3

async function loadArticles(): Promise<PublicPostListItem[]> {
  if (import.meta.env.DEV && isDemoSections()) return (await import('@/lib/home-demo')).DEMO_ARTICLES
  return (await fetchPublicPosts({ kind: 'article', limit: POSTS_COUNT })).items
}

function PostTitleLink({ post }: { post: PublicPostListItem }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="after:absolute after:inset-0 after:rounded-block after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring group-hover:underline underline-offset-4 decoration-1"
    >
      {post.title}
    </Link>
  )
}

const CARD_MOTION =
  'transition-transform duration-200 ease-out hover:-translate-y-1 active:scale-97 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100'

function FeaturedPost({ post }: { post: PublicPostListItem }) {
  const frame = `group relative overflow-hidden rounded-block aspect-[4/5] md:col-span-2 md:aspect-[2/1] xl:col-span-2 xl:aspect-auto xl:min-h-[26rem] ${CARD_MOTION}`
  if (!post.coverImage) {
    return (
      <article className={`${frame} flex flex-col justify-between bg-accent p-6 text-accent-foreground md:p-8`}>
        <time dateTime={post.publishedAt} className={`${LABEL} text-accent-foreground`}>
          {formatPostDate(post.publishedAt)}
        </time>
        <div>
          <h3 className="font-heading text-h3 font-bold leading-[1.12] [text-wrap:balance]">
            <PostTitleLink post={post} />
          </h3>
          {post.excerpt && <p className="mt-3 max-w-[46ch] text-body leading-body line-clamp-3">{post.excerpt}</p>}
          <PostAdNote isAd={post.isAd} advertiser={post.advertiser} erid={post.erid} className="mt-3" />
        </div>
      </article>
    )
  }
  return (
    <article className={`${frame} grid bg-muted`}>
      <img
        src={post.coverImage}
        alt=""
        width={1200}
        height={800}
        loading="lazy"
        decoding="async"
        className="col-start-1 row-start-1 h-full w-full object-cover"
      />
      <div className="col-start-1 row-start-1 mx-3 mb-3 self-end rounded-media bg-card p-5 md:mx-0 md:ml-4 md:mb-4 md:w-[min(28rem,calc(100%-2rem))] md:p-6">
        <time dateTime={post.publishedAt} className={`${LABEL} text-muted-foreground`}>
          {formatPostDate(post.publishedAt)}
        </time>
        <h3 className="mt-2 font-heading text-[1.25rem] md:text-[1.5rem] font-bold leading-[1.2] text-foreground line-clamp-3">
          <PostTitleLink post={post} />
        </h3>
        {post.excerpt && (
          <p className="mt-2 text-body-sm leading-body text-muted-foreground line-clamp-2 md:line-clamp-3">
            {post.excerpt}
          </p>
        )}
        <PostAdNote isAd={post.isAd} advertiser={post.advertiser} erid={post.erid} className="mt-2" />
      </div>
    </article>
  )
}

function PostCard({ post }: { post: PublicPostListItem }) {
  const hasCover = Boolean(post.coverImage)
  const frame = hasCover
    ? 'grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-4 p-3 md:flex md:flex-col md:items-stretch md:gap-0 md:overflow-hidden md:p-0'
    : 'p-5 md:flex md:flex-col md:p-6'
  return (
    <article className={`group relative rounded-block bg-card ${frame} ${CARD_MOTION}`}>
      {hasCover && (
        <img
          src={post.coverImage ?? undefined}
          alt=""
          width={1200}
          height={800}
          loading="lazy"
          decoding="async"
          className="size-24 rounded-media object-cover md:size-auto md:w-full md:aspect-[3/2] md:rounded-none xl:aspect-[4/3]"
        />
      )}
      <div className={hasCover ? 'md:flex md:flex-1 md:flex-col md:p-5' : 'md:flex md:flex-1 md:flex-col'}>
        <time dateTime={post.publishedAt} className={`${LABEL} text-muted-foreground`}>
          {formatPostDate(post.publishedAt)}
        </time>
        <h3
          className={`font-heading font-semibold leading-[1.3] line-clamp-3 ${
            hasCover ? 'mt-1 text-body md:mt-2 md:text-[1.125rem] md:leading-[1.25]' : 'mt-2 text-[1.125rem] leading-[1.25] md:mt-auto'
          }`}
        >
          <PostTitleLink post={post} />
        </h3>
        {post.excerpt && (
          <p
            className={`text-body-sm leading-body text-muted-foreground ${
              hasCover ? 'hidden md:mt-2 md:line-clamp-3' : 'mt-2 line-clamp-5'
            }`}
          >
            {post.excerpt}
          </p>
        )}
        <PostAdNote isAd={post.isAd} advertiser={post.advertiser} erid={post.erid} className="mt-2" />
      </div>
    </article>
  )
}

export function BlogSection() {
  const items = useHomeList(loadArticles)
  if (!items || items.length < POSTS_COUNT) return null

  const [lead, ...rest] = items.slice(0, POSTS_COUNT)

  return (
    <section aria-labelledby="home-blog-title" data-home="blog" className="bg-background py-10 md:py-14">
      <div className="container-app">
        <SectionHeader
          eyebrow="Журнал"
          title="Статьи об уходе"
          titleId="home-blog-title"
          sub="Разбираем составы, порядок нанесения и уход по типу кожи."
          link={{ to: '/blog', text: 'Все статьи' }}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
          <FeaturedPost post={lead} />
          {rest.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  )
}
