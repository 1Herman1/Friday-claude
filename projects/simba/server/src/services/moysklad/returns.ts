import { msRequest } from './client.js'
import type { MsDocumentResponse, MsEntity, MsDocumentPosition, MsDocument } from './types.js'

export type ReturnPosition = {
  moyskladId: string | null
  sku: string | null
  name: string
  quantity: number
  price: number // копейки
}

export async function createReturnDocument(input: {
  orderId: string
  positions: ReturnPosition[]
}): Promise<{ ok: true; msId: string } | { ok: false; reason: string }> {
  try {
    // ─── ВАЛИДАЦИЯ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ──────────────────────────────────────

    const token = process.env.MOYSKLAD_TOKEN
    if (!token) {
      return { ok: false, reason: 'МойСклад не настроен' }
    }

    const writeEnabled = process.env.MOYSKLAD_WRITE_ENABLED === 'true'
    if (!writeEnabled) {
      return { ok: false, reason: 'Запись в МойСклад выключена' }
    }

    const warehouseId = process.env.MOYSKLAD_WAREHOUSE_ID
    if (!warehouseId) {
      return { ok: false, reason: 'Не указан ID склада МойСклада' }
    }

    const organizationId = process.env.MOYSKLAD_ORGANIZATION_ID
    if (!organizationId) {
      return { ok: false, reason: 'Не указана организация МойСклада' }
    }

    // ─── ФИЛЬТРАЦИЯ ПОЗИЦИЙ ──────────────────────────────────────────────────

    const validPositions = input.positions.filter((pos) => pos.moyskladId)

    if (validPositions.length === 0) {
      return { ok: false, reason: 'Ни одна позиция не связана с МойСклад' }
    }

    // ─── ПРОВЕРКА ИДЕМПОТЕНТНОСТИ ───────────────────────────────────────────

    const returnDescription = `Возврат по заказу ${input.orderId} (сайт)`

    // Ищем существующий документ с этим описанием.
    // Фильтр в МойСкладе: filter=description=="..."
    const encodedDesc = encodeURIComponent(returnDescription)
    let existingDoc: MsDocumentResponse | null = null

    try {
      const searchResult = await msRequest<{ rows: MsDocument[] }>(
        `/entity/enter?filter=description=="${encodedDesc}"`,
        'GET'
      )
      if (searchResult.rows?.length > 0) {
        existingDoc = searchResult.rows[0] as MsDocumentResponse
      }
    } catch (error) {
      // Ошибка при поиске — логируем, но продолжаем. Может быть проблема с фильтром.
      console.error('[МойСклад] Ошибка при поиске существующего документа:', error)
    }

    if (existingDoc?.id) {
      // Документ уже создан ранее, возвращаем его ID
      return { ok: true, msId: existingDoc.id }
    }

    // ─── СОЗДАНИЕ ДОКУМЕНТА ──────────────────────────────────────────────────

    // Преобразуем позиции в формат МойСклада
    const msPositions: MsDocumentPosition[] = validPositions.map((pos) => ({
      quantity: pos.quantity,
      price: pos.price, // цена в копейках как есть
      assortment: {
        id: pos.moyskladId!,
        meta: {
          type: 'variant', // или 'product', зависит от типа в МойСкладе
        },
      },
    }))

    const documentData: Partial<MsDocument> = {
      organization: {
        id: organizationId,
        meta: {
          type: 'organization',
        },
      },
      store: {
        id: warehouseId,
        meta: {
          type: 'store', // или 'warehouse', в МойСкладе в API это 'store'
        },
      },
      positions: msPositions,
      description: returnDescription,
    }

    // Создаём документ типа enter (приёмка)
    const created = await msRequest<MsDocumentResponse>(
      '/entity/enter',
      'POST',
      documentData
    )

    if (!created?.id) {
      return { ok: false, reason: 'МойСклад не вернул ID созданного документа' }
    }

    return { ok: true, msId: created.id }
  } catch (error) {
    // Catch-all для непредвиденных ошибок
    const message = error instanceof Error ? error.message : String(error)
    console.error('[МойСклад] Ошибка при создании документа возврата:', message)

    // Пробуем определить категорию ошибки для более дружелюбного сообщения
    if (message.includes('401') || message.includes('403')) {
      return { ok: false, reason: 'Токен МойСклад недействителен или не имеет прав' }
    }
    if (message.includes('429')) {
      return { ok: false, reason: 'МойСклад перегружен, повторите позже' }
    }
    if (message.includes('500')) {
      return { ok: false, reason: 'Ошибка сервера МойСклада' }
    }

    return { ok: false, reason: `Ошибка интеграции МойСклада: ${message}` }
  }
}
