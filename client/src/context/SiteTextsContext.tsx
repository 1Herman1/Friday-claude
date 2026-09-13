import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { siteTextsApi } from '../lib/api'

interface SiteTextsContextType {
  texts: Record<string, string>
}

const SiteTextsContext = createContext<SiteTextsContextType | undefined>(undefined)

export function SiteTextsProvider({ children }: { children: ReactNode }) {
  const [texts, setTexts] = useState<Record<string, string>>({})

  useEffect(() => {
    siteTextsApi
      .list()
      .then((res) => {
        setTexts(res.data.texts || {})
      })
      .catch(() => {
        // Ошибка при загрузке текстов — просто используем пустую карту
        // и фоллбэки будут применены везде
        setTexts({})
      })
  }, [])

  return (
    <SiteTextsContext.Provider value={{ texts }}>
      {children}
    </SiteTextsContext.Provider>
  )
}

/** Получить текст сайта или фоллбэк.
    Если текст найден в загруженной карте — вернуть его, иначе вернуть fallback. */
export function useSiteText(key: string, fallback: string): string {
  const context = useContext(SiteTextsContext)
  if (!context) {
    throw new Error('useSiteText must be used within SiteTextsProvider')
  }
  return context.texts[key] ?? fallback
}
