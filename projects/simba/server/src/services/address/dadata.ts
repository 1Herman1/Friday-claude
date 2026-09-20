import type { AddressSuggestion } from '@simba/shared'

interface DaDataResponse {
  suggestions: Array<{
    value: string
    data: {
      city?: string
      settlement?: string
      street_with_type?: string
      street?: string
      house?: string
      block_type?: string
      block?: string
      postal_code?: string
      geo_lat?: string
      geo_lon?: string
    }
  }>
}

/**
 * Получить подсказки адреса от DaData.
 * Таймаут 5 секунд. Без токена бросает Error('not configured').
 */
export async function suggestAddress(query: string): Promise<AddressSuggestion[]> {
  const token = process.env.DADATA_TOKEN
  if (!token) {
    throw new Error('not configured')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(
      'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          count: 7,
          locations: [{ country_iso_code: 'RU' }],
          from_bound: { value: 'city' },
          to_bound: { value: 'house' },
        }),
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      throw new Error(`DaData returned ${response.status}`)
    }

    const data = (await response.json()) as DaDataResponse

    return data.suggestions.map((s) => {
      const { data: d } = s
      const city = d.city || d.settlement || ''
      const street = d.street_with_type || d.street || ''
      const house = d.house
        ? d.block_type && d.block
          ? `${d.house} ${d.block_type}${d.block}`
          : d.house
        : ''
      const lat = d.geo_lat ? Number(d.geo_lat) : undefined
      const lon = d.geo_lon ? Number(d.geo_lon) : undefined

      return {
        value: s.value,
        city,
        street,
        house,
        postalCode: d.postal_code,
        lat,
        lon,
        complete: d.house != null,
      } as AddressSuggestion
    })
  } finally {
    clearTimeout(timeoutId)
  }
}
