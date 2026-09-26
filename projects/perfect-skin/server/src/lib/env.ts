// Среда определяется здесь и только здесь.
//
// Раньше каждое место сравнивало process.env.NODE_ENV само, и сравнения
// разошлись по направлению: почта и SMS при незнакомом значении брали боевой
// отправщик (безопасно), а куки и проверка секретов — наоборот, считали
// окружение разработкой и снимали защиту. Фейлились в опасную сторону ровно
// те места, которые за безопасность и отвечают.
//
// Поэтому неизвестное значение считается боевым: ошибиться в сторону строгости
// дёшево — сервер не поднимется и скажет, чего не хватает. Ошибиться в сторону
// мягкости значит тихо остаться без защиты.
//
// 'test' в разработке намеренно: иначе тесты потребовали бы боевых секретов.
export const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'

export const isProduction = !isDevelopment

// Временный ручной флаг для доступа по голому IP без сертификата: секьюрность
// кук на «боевом» протоколе иначе всегда true и браузер режет Set-Cookie по
// http://. Ничего в проде не трогает, пока переменная не выставлена явно.
export const cookieInsecure = process.env.PS_COOKIE_INSECURE === '1'

// Каталог для хранения загруженных документов при подаче заявки на профессиональный доступ.
// В разработке по умолчанию ./var/pro-docs, в боевом окружении обязателен.
export const proDocs = getDirWithDefault('PS_PRO_DOCS_DIR', isDevelopment ? './var/pro-docs' : null)

// Email адрес для уведомлений менеджера о новых заявках на проверку.
// Пусто = без уведомлений (опционально).
export const proNotifyEmail = process.env.PS_PRO_NOTIFY_EMAIL || ''

function getDirWithDefault(key: string, defaultValue: string | null): string {
  const value = process.env[key]
  if (!value) {
    if (defaultValue === null) {
      console.error(`Error: environment variable ${key} is required in production`)
      process.exit(1)
    }
    return defaultValue
  }
  return value
}
