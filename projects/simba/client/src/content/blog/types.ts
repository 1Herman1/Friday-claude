import type { ReactNode } from 'react'

export type BlogCategory =
  | 'Сравнения кормов'
  | 'Питание'
  | 'Здоровье'
  | 'Кошки'
  | 'Собаки'
  | 'Ветдиеты'

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  categories: BlogCategory[]
  /** ISO, '2026-07-15' */
  date: string
  readingMinutes: number
  status: 'published' | 'draft'
  cover?: string
  metaTitle: string
  metaDescription: string
  /** У черновиков тела нет — страница такой статьи отдаёт «не найдено». */
  body?: () => ReactNode
  /** Тело статьи из админки (markdown); у встроенных статей его нет. */
  markdown?: string
}
