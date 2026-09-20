import { DRAFTS } from './drafts'
import farminaVsMonge from './posts/farmina-vs-monge'
import farminaNdLineyki from './posts/farmina-nd-lineyki'
import mongeLineyki from './posts/monge-lineyki'
import kotyataRatsion from './posts/kotyata-ratsion'
import labradorRatsion from './posts/labrador-ratsion'
import originalIliPoddelka from './posts/original-ili-poddelka'
import koshkiAllergiya from './posts/koshki-allergiya'
import shchenkiRatsion from './posts/shchenki-ratsion'
import smenaKormaKoshke from './posts/smena-korma-koshke'
import sukhoyVlazhnyKorm from './posts/sukhoy-vlazhny-korm'

export type { BlogCategory, BlogPost } from './types'
import type { BlogPost } from './types'

const PUBLISHED: BlogPost[] = [
  farminaVsMonge,
  farminaNdLineyki,
  mongeLineyki,
  kotyataRatsion,
  labradorRatsion,
  originalIliPoddelka,
  koshkiAllergiya,
  shchenkiRatsion,
  smenaKormaKoshke,
  sukhoyVlazhnyKorm,
]

export const BLOG_POSTS: BlogPost[] = [...PUBLISHED, ...DRAFTS]

/** Черновики в списке не показываются, свежие статьи — первыми. */
export function getPublished(): BlogPost[] {
  return BLOG_POSTS.filter((post) => post.status === 'published').sort((a, b) =>
    b.date.localeCompare(a.date)
  )
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug)
}
