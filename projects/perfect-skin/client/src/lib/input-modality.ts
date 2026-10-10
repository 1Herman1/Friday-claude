// Чем пользователь управлял последним — клавиатурой или пальцем/мышью.
// Фокус переводим программно только для клавиатуры: на телефоне он оставляет подсветку.
let last: 'key' | 'pointer' = 'pointer'
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { last = 'key' }, true)
  window.addEventListener('pointerdown', () => { last = 'pointer' }, true)
}
export const usedKeyboard = () => last === 'key'
