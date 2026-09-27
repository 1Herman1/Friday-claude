export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL
  return envUrl || 'http://localhost:3000'
}

export async function fetchApi<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  // Снимок-режим: без сервера каталог обслуживается из статического JSON.
  if (import.meta.env.VITE_API_MODE === 'snapshot' && (!options?.method || options.method === 'GET')) {
    const { resolveFromSnapshot } = await import('./snapshot')
    return resolveFromSnapshot<T>(path)
  }
  const baseUrl = getApiUrl()
  const url = new URL(path, baseUrl)

  const headers: Record<string, string> = {}

  // Если body это FormData, браузер сам добавит Content-Type с boundary.
  // Для остальных случаев ставим application/json.
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  // Токен не хранится на клиенте: вход держится на куке ps_auth с httpOnly,
  // её браузер прикладывает сам благодаря credentials: 'include' ниже.
  // Хранить копию токена в localStorage значило бы отдать сессию любому XSS.

  // Мержим с пользовательскими headers
  if (options?.headers) {
    const customHeaders = options.headers as Record<string, string>
    Object.assign(headers, customHeaders)
  }

  let response: Response
  try {
    response = await fetch(url.toString(), {
      ...options,
      credentials: 'include',
      headers,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Нет соединения с сервером')
  }

  let data: unknown

  try {
    data = await response.json()
  } catch {
    if (!response.ok) {
      throw new ApiError(response.status, 'PARSE_ERROR', 'Ошибка при разборе ответа сервера')
    }
    return {} as T
  }

  if (!response.ok) {
    const errorData = data as ErrorResponse
    throw new ApiError(
      response.status,
      errorData.error?.code || 'UNKNOWN_ERROR',
      errorData.error?.message || 'Неизвестная ошибка',
      errorData.error?.details,
    )
  }

  return data as T
}

export async function fetchBlob(path: string): Promise<Blob> {
  const baseUrl = getApiUrl()
  const url = new URL(path, baseUrl)

  let response: Response
  try {
    response = await fetch(url.toString(), {
      credentials: 'include',
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Нет соединения с сервером')
  }

  if (!response.ok) {
    // Пытаемся спарсить JSON для ошибки
    let errorData: ErrorResponse | null = null
    try {
      errorData = await response.json()
    } catch {
      // Если не JSON, создаём ошибку с текстом ответа
      throw new ApiError(response.status, 'BLOB_ERROR', `Ошибка загрузки: ${response.statusText}`)
    }
    if (errorData) {
      throw new ApiError(
        response.status,
        errorData.error?.code || 'UNKNOWN_ERROR',
        errorData.error?.message || 'Ошибка при загрузке файла',
        errorData.error?.details,
      )
    }
    throw new ApiError(response.status, 'BLOB_ERROR', `Ошибка при загрузке файла`)
  }

  return response.blob()
}
