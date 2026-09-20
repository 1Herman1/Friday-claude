import { useHashScroll } from '../hooks/useHashScroll'

/**
 * Компонент активирует плавный скролл к якорям при смене hash в URL.
 * Не рендерится — только инициализирует хук.
 */
export default function HashScroll() {
  useHashScroll()
  return null
}
