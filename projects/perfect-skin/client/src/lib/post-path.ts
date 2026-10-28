import type { PostKind, PublicPostListItem } from '@/lib/admin-api'

export const SECTION_PATH: Record<PostKind, string> = {
  article: '/blog',
  news: '/news',
}

export const KIND_LABEL: Record<PostKind, string> = {
  article: 'Статья',
  news: 'Новость',
}

export function postPath(post: Pick<PublicPostListItem, 'slug' | 'kind'>): string {
  return `${SECTION_PATH[post.kind]}/${post.slug}`
}
