import type { MsAssortmentItem, MsAssortmentResponse, MsStockResponse, MsStockRow, MsEntity, MsDocument } from './types.js'

const BASE_URL = 'https://api.moysklad.ru/api/remap/1.2'

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export async function msRequest<T>(
  path: string,
  method: RequestMethod = 'GET',
  body?: unknown,
  attempt = 1
): Promise<T> {
  const token = process.env.MOYSKLAD_TOKEN
  if (!token) {
    throw new Error('Не задана переменная MOYSKLAD_TOKEN')
  }

  // Пауза перед запросом
  await sleep(200)

  const url = `${BASE_URL}${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (res.ok) {
      return (await res.json()) as T
    }

    if (res.status === 429) {
      if (attempt > 3) {
        throw new Error(`МойСклад вернул 429 после 3 попыток`)
      }
      const retryAfter = res.headers.get('X-Lognex-Retry-TimeInterval')
      const waitMs = retryAfter ? parseInt(retryAfter, 10) : 3000
      await sleep(waitMs)
      return msRequest<T>(path, method, body, attempt + 1)
    }

    if (res.status >= 500) {
      if (attempt > 1) {
        throw new Error(`МойСклад вернул ${res.status} после повторной попытки`)
      }
      await sleep(2000)
      return msRequest<T>(path, method, body, attempt + 1)
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error('Токен МойСклад недействителен или не имеет прав')
    }

    throw new Error(`МойСклад вернул ${res.status}`)
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchAssortment(): Promise<MsAssortmentItem[]> {
  const limit = 1000
  const result: MsAssortmentItem[] = []
  let offset = 0
  const maxPages = 50

  for (let page = 0; page < maxPages; page++) {
    const path = `/entity/assortment?limit=${limit}&offset=${offset}`
    const response = await msRequest<MsAssortmentResponse>(path)

    result.push(...response.rows)

    if (response.rows.length < limit) {
      break
    }

    offset += limit
  }

  if (result.length >= limit * maxPages) {
    throw new Error(`Ограничение на количество элементов (${maxPages * limit}) превышено`)
  }

  return result
}

export async function fetchStockCurrent(): Promise<MsStockRow[]> {
  // Краткий отчёт об остатках приходит ПЛОСКИМ массивом, в отличие от остальных
  // ответов МойСклад с обёрткой { rows: [...] }. Принимаем обе формы.
  // freeStock, а не stock: «остаток» в МоемСкладе не вычитает резерв под уже
  // собранные заказы. На отчёте владельца это 2133 против 1817 доступных —
  // 316 штук, которые витрина продала бы повторно.
  const response = await msRequest<MsStockResponse | MsStockRow[]>(
    '/report/stock/all/current?stockType=freeStock'
  )
  return Array.isArray(response) ? response : (response.rows ?? [])
}
