/**
 * Подсказки адреса через DaData.
 */

export interface AddressSuggestion {
  value: string          // Строка для показа пользователю
  city: string           // Город (может быть пусто)
  street: string         // Улица с типом (может быть пусто)
  house: string          // Дом + корпус/блок (может быть пусто)
  postalCode?: string    // Почтовый индекс
  lat?: number           // Широта
  lon?: number           // Долгота
  complete: boolean      // Адрес полный (включая дом)
}
