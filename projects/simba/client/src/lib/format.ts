export function formatPrice(kopecks: number): string {
  return `${(kopecks / 100).toLocaleString('ru-RU')} ₽`
}

/** Русское склонение: plural(1, 'товар', 'товара', 'товаров') → 'товар'. */
export function plural(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(count) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

/** Число вместе со словом: «1 товар», «3 товара», «12 товаров». */
export function pluralize(count: number, one: string, few: string, many: string): string {
  return `${count.toLocaleString('ru-RU')} ${plural(count, one, few, many)}`
}

/** Бонусы всегда пишем по-русски со склонением: «+150 бонусов». */
export function formatBonuses(count: number): string {
  return pluralize(count, 'бонус', 'бонуса', 'бонусов')
}

/** Дата и время заказа: «14 мая, 18:42». Берётся из ответа сервера, а не из
    new Date() — иначе на экране будет время покупателя, а в базе другое. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
