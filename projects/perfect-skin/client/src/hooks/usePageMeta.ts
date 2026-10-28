import { useEffect } from 'react'

interface PageMeta {
  title: string
  description: string
  path: string
}

// SPA отдаёт один index.html: на время жизни страницы подменяем title, description и canonical,
// при уходе возвращаем прежние значения, чтобы следующая страница не унаследовала чужие
export function usePageMeta({ title, description, path }: PageMeta): void {
  useEffect(() => {
    const prevTitle = document.title
    const descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const prevDescription = descriptionTag?.content ?? ''
    const canonical = document.createElement('link')
    canonical.rel = 'canonical'
    canonical.href = `${window.location.origin}${path}`

    document.title = title
    if (descriptionTag && description) descriptionTag.content = description
    document.head.append(canonical)

    return () => {
      document.title = prevTitle
      if (descriptionTag) descriptionTag.content = prevDescription
      canonical.remove()
    }
  }, [title, description, path])
}
