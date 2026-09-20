/**
 * Счётчик-основанная блокировка скролла для совместимости с несколькими одновременно
 * открытыми оверлеями (корзина + избранное + модалка квиза). Восстанавливает
 * исходное состояние только когда закроется последний оверлей.
 */

let scrollLockCount = 0
let savedOverflow = ''
let savedPaddingRight = ''

export function lockBodyScroll(): void {
  if (scrollLockCount === 0) {
    savedOverflow = document.body.style.overflow
    savedPaddingRight = document.body.style.paddingRight
    const gap = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (gap > 0) document.body.style.paddingRight = `${gap}px`
  }
  scrollLockCount++
}

export function unlockBodyScroll(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.body.style.overflow = savedOverflow
    document.body.style.paddingRight = savedPaddingRight
  }
}
