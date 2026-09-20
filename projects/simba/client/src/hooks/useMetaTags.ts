import { useEffect } from 'react'

type MetaTags = {
  title: string
  description: string
  /** Адрес страницы для поисковика. По умолчанию — текущий, без параметров. */
  canonical?: string
  /** Страницы вроде «не найдено» не должны попадать в индекс. */
  noindex?: boolean
}

/**
 * Заголовок и описание страницы. В SPA один index.html на весь сайт, поэтому
 * теги правятся в DOM при монтировании и возвращаются к прежним при уходе.
 */
export function useMetaTags({ title, description, canonical, noindex }: MetaTags) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    let descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!descriptionTag) {
      descriptionTag = document.createElement('meta')
      descriptionTag.name = 'description'
      document.head.appendChild(descriptionTag)
    }
    const previousDescription = descriptionTag.content
    descriptionTag.content = description

    let canonicalTag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonicalTag) {
      canonicalTag = document.createElement('link')
      canonicalTag.rel = 'canonical'
      document.head.appendChild(canonicalTag)
    }
    const previousCanonical = canonicalTag.href
    canonicalTag.href = canonical ?? window.location.origin + window.location.pathname

    // Общий robots в index.html сейчас и так noindex — тег ниже нужен на будущее,
    // когда сайт откроют: страница «не найдено» индексироваться не должна никогда.
    let robotsTag: HTMLMetaElement | null = null
    let previousRobots = ''
    if (noindex) {
      robotsTag = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
      if (!robotsTag) {
        robotsTag = document.createElement('meta')
        robotsTag.name = 'robots'
        document.head.appendChild(robotsTag)
      }
      previousRobots = robotsTag.content
      robotsTag.content = 'noindex, follow'
    }

    return () => {
      document.title = previousTitle
      descriptionTag.content = previousDescription
      canonicalTag.href = previousCanonical
      if (robotsTag) robotsTag.content = previousRobots
    }
  }, [title, description, canonical, noindex])
}
