import { Link } from 'react-router-dom'
import { fetchPublicPosts, type PublicPostListItem } from '@/lib/admin-api'
import { formatPostDate } from '@/lib/format'
import { isDemoSections } from '@/lib/demo-mode'
import { useHomeList } from '@/hooks/useHomeList'
import { LABEL } from '@/components/about/classes'
import { PostAdNote } from '@/components/blog/PostAdNote'
import { SectionHeader } from '@/components/home/SectionHeader'
import { KIND_LABEL, SECTION_PATH, postPath } from '@/lib/post-path'

const POSTS_COUNT = 3

// Журнал на главной общий: статьи и новости вперемешку, свежие первыми
async function loadPosts(): Promise<PublicPostListItem[]> {
  if (import.meta.env.DEV && isDemoSections()) {
    const { DEMO_ARTICLES, DEMO_NEWS } = await import('@/lib/home-demo')
    return [...DEMO_ARTICLES, ...DEMO_NEWS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  }
  return (await fetchPublicPosts({ limit: POSTS_COUNT })).items
}

type TitleTone = 'light' | 'accent' | 'dark'

const TITLE_TONE: Record<TitleTone, string> = {
  light: 'group-hover:text-muted-foreground focus-visible:text-muted-foreground',
  accent: 'group-hover:text-accent-foreground/70 focus-visible:text-accent-foreground/70',
  dark: 'group-hover:text-primary-foreground/70 focus-visible:text-primary-foreground/70',
}

function PostTitleLink({ post, tone }: { post: PublicPostListItem; tone: TitleTone }) {
  return (
    <Link
      to={postPath(post)}
      className={`after:absolute after:inset-0 after:rounded-block after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring transition-colors duration-200 ease-out motion-reduce:transition-none ${TITLE_TONE[tone]}`}
    >
      {post.title}
    </Link>
  )
}

const CARD_MOTION =
  'transition-transform duration-200 ease-out hover:-translate-y-1 active:scale-97 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100'

const LONG_TITLE_LENGTH = 90

function FeaturedPost({ post }: { post: PublicPostListItem }) {
  const frame = `group relative rounded-block aspect-[4/5] md:col-span-2 md:aspect-[2/1] xl:col-span-2 xl:aspect-auto xl:min-h-[26rem] ${CARD_MOTION}`
  if (!post.coverImage) {
    return (
      <article className={`${frame} flex flex-col justify-between bg-accent p-6 text-accent-foreground md:p-8`}>
        <time dateTime={post.publishedAt} className={`${LABEL} text-accent-foreground`}>
          {KIND_LABEL[post.kind]} · {formatPostDate(post.publishedAt)}
        </time>
        <div>
          <h3 className="font-heading text-h3 font-bold leading-[1.12] [text-wrap:balance]">
            <PostTitleLink post={post} tone="accent" />
          </h3>
          {post.excerpt && <p className="mt-3 max-w-[46ch] text-body leading-body line-clamp-3">{post.excerpt}</p>}
          <PostAdNote
            isAd={post.isAd}
            advertiser={post.advertiser}
            erid={post.erid}
            className="mt-3"
            tone="text-accent-foreground"
          />
        </div>
      </article>
    )
  }
  return (
    <article className={`group relative overflow-hidden rounded-block bg-muted md:col-span-2 md:aspect-[3/2] xl:col-span-2 ${CARD_MOTION}`}>
      <img
        src={post.coverImage}
        alt=""
        width={1200}
        height={800}
        loading="lazy"
        decoding="async"
        className="block aspect-[3/2] w-full object-cover md:absolute md:inset-0 md:aspect-auto md:h-full"
      />
      <Link to={postPath(post)} tabIndex={-1} aria-hidden="true" className="absolute inset-0" />
      <div className="bg-card p-5 md:absolute md:left-4 md:bottom-4 md:w-[min(24rem,44%)] md:rounded-media md:p-4">
        <time dateTime={post.publishedAt} className={`${LABEL} text-muted-foreground`}>
          {KIND_LABEL[post.kind]} · {formatPostDate(post.publishedAt)}
        </time>
        <h3
          className={`mt-2 font-heading text-[1.125rem] font-bold leading-[1.2] text-foreground line-clamp-3 md:line-clamp-none ${
            post.title.length > LONG_TITLE_LENGTH ? 'md:text-[1.125rem]' : 'md:text-[1.25rem]'
          }`}
        >
          <PostTitleLink post={post} tone="light" />
        </h3>
        {post.excerpt && (
          <p className="mt-2 text-body-sm leading-body text-muted-foreground line-clamp-2 md:hidden">{post.excerpt}</p>
        )}
        <PostAdNote isAd={post.isAd} advertiser={post.advertiser} erid={post.erid} className="mt-2" />
      </div>
    </article>
  )
}

interface PostCardProps {
  post: PublicPostListItem
  headingLevel?: 2 | 3
  showKind?: boolean
}

export function PostCard({ post, headingLevel = 3, showKind = false }: PostCardProps) {
  const hasCover = Boolean(post.coverImage)
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const frame = hasCover
    ? 'bg-card grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 p-3 md:flex md:flex-col md:items-stretch md:gap-0 md:overflow-hidden md:p-0'
    : 'flex flex-col bg-primary p-5 text-primary-foreground md:p-6'
  const headingClass = hasCover
    ? 'mt-1 font-heading font-semibold leading-[1.3] text-body line-clamp-3 md:mt-2 md:text-[1.0625rem] md:leading-[1.25]'
    : 'mt-3 text-[1.25rem] leading-[1.2] font-bold [text-wrap:balance] line-clamp-4'
  const headingLevelClass = headingLevel === 2 ? ' normal-case tracking-normal' : ''
  return (
    <article className={`group relative rounded-block ${frame} ${CARD_MOTION}`}>
      {hasCover && (
        <img
          src={post.coverImage ?? undefined}
          alt=""
          width={1200}
          height={800}
          loading="lazy"
          decoding="async"
          className="w-28 aspect-[3/2] rounded-media object-cover md:size-auto md:w-full md:aspect-[3/2] md:rounded-none"
        />
      )}
      <div className={hasCover ? 'md:flex md:flex-1 md:flex-col md:p-5' : 'flex flex-1 flex-col'}>
        <time dateTime={post.publishedAt} className={`${LABEL} ${hasCover ? 'text-muted-foreground' : 'text-primary-foreground/80'}`}>
          {showKind && `${KIND_LABEL[post.kind]} · `}
          {formatPostDate(post.publishedAt)}
        </time>
        <Heading className={`${headingClass}${headingLevelClass}`}>
          <PostTitleLink post={post} tone={hasCover ? 'light' : 'dark'} />
        </Heading>
        {post.excerpt && (
          <p
            className={
              hasCover
                ? 'text-body-sm leading-body text-muted-foreground hidden md:mt-2 md:line-clamp-3'
                : 'mt-3 text-body-sm leading-body text-primary-foreground/80 line-clamp-5'
            }
          >
            {post.excerpt}
          </p>
        )}
        <PostAdNote
          isAd={post.isAd}
          advertiser={post.advertiser}
          erid={post.erid}
          className="mt-2"
          tone={hasCover ? 'text-muted-foreground' : 'text-primary-foreground/80'}
        />
        {!hasCover && (
          <span
            aria-hidden="true"
            className="mt-auto hidden items-center gap-2 pt-6 font-heading text-body-sm font-semibold md:inline-flex"
          >
            {post.kind === 'news' ? 'Читать новость' : 'Читать статью'}{' '}
            <span className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
              →
            </span>
          </span>
        )}
      </div>
    </article>
  )
}

export function BlogSection() {
  const items = useHomeList(loadPosts, [])
  if (!items || items.length < POSTS_COUNT) return null

  const [lead, ...rest] = items.slice(0, POSTS_COUNT)
  const hasNews = items.some((post) => post.kind === 'news')

  return (
    <section aria-labelledby="home-blog-title" data-home="blog" className="bg-background py-10 md:py-14">
      <div className="container-app">
        <SectionHeader
          eyebrow="Журнал"
          title="Статьи и новости"
          titleId="home-blog-title"
          sub="Разбираем составы и уход по типу кожи, рассказываем о новинках магазина."
          links={[
            { to: SECTION_PATH.article, text: 'Все статьи' },
            ...(hasNews ? [{ to: SECTION_PATH.news, text: 'Все новости' }] : []),
          ]}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
          <FeaturedPost post={lead} />
          {rest.map((post) => (
            <PostCard key={post.id} post={post} showKind />
          ))}
        </div>
      </div>
    </section>
  )
}
