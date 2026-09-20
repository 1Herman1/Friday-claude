// Сутки магазина — московские (UTC+3, без перевода часов). Все «сегодня» и бакеты графика считаются в них.
export const MSK_OFFSET_MS = 3 * 60 * 60 * 1000

// Начало московских суток, в которые попадает момент d (как UTC-момент).
export function mskDayStart(d: Date): Date {
  const shifted = new Date(d.getTime() + MSK_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - MSK_OFFSET_MS)
}

// Ключ дня 'YYYY-MM-DD' по московскому времени.
export function mskDateKey(d: Date): string {
  return new Date(d.getTime() + MSK_OFFSET_MS).toISOString().slice(0, 10)
}

// Дата (UTC-полночь) московского дня — для колонки SiteVisit.day (@db.Date).
export function mskDayAsDate(d: Date): Date {
  const shifted = new Date(d.getTime() + MSK_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}
