import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'

type DrawerName = 'cart' | 'favorites' | 'quiz' | null

interface DrawerContextType {
  drawer: DrawerName
  openCart: () => void
  openFavorites: () => void
  openQuiz: () => void
  close: () => void
}

const DrawerContext = createContext<DrawerContextType | null>(null)

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<DrawerName>(null)

  // useCallback/useMemo здесь обязательны, а не «для оптимизации»: Layout держит
  // эффект «закрыть панель при смене маршрута» с `close` в зависимостях. Пока
  // функции пересоздавались на каждом рендере, открытие панели меняло состояние
  // -> новый `close` -> эффект срабатывал заново -> панель закрывалась в тот же
  // кадр. В итоге не открывались ни корзина, ни избранное, ни квиз.
  const openCart = useCallback(() => setDrawer('cart'), [])
  const openFavorites = useCallback(() => setDrawer('favorites'), [])
  const openQuiz = useCallback(() => setDrawer('quiz'), [])
  const close = useCallback(() => setDrawer(null), [])

  const value = useMemo(
    () => ({ drawer, openCart, openFavorites, openQuiz, close }),
    [drawer, openCart, openFavorites, openQuiz, close]
  )

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
}

export function useDrawer(): DrawerContextType {
  const context = useContext(DrawerContext)
  if (!context) {
    throw new Error('useDrawer must be used within DrawerProvider')
  }
  return context
}
