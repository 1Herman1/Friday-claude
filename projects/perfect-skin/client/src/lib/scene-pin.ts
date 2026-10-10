import { useSyncExternalStore } from 'react'

// «Сцена закреплена»: пока клиент листает сцену «Бестселлеры», шапка и нижняя панель убраны.
let pinned = false
const listeners = new Set<() => void>()

export function setScenePinned(value: boolean) {
  if (pinned === value) return
  pinned = value
  listeners.forEach((l) => l())
}

export function useScenePinned() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => pinned,
    () => false,
  )
}
