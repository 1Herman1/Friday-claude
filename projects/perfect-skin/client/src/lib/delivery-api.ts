import { fetchApi } from './api'

export interface CityOption {
  code: number
  name: string
}

export interface PickupPoint {
  code: string
  type: 'PVZ' | 'POSTAMAT'
  name: string
  address: string
  workTime: string | null
  metro: string | null
  lat: number
  lon: number
}

export interface PointsPage {
  items: PickupPoint[]
  total: number
}

export const POINTS_PAGE_SIZE = 10

export async function getCities(q: string): Promise<CityOption[]> {
  const params = new URLSearchParams({ q })
  const res = await fetchApi<{ items: CityOption[] }>(`/api/v1/delivery/cities?${params}`)
  return res.items
}

export async function getPoints(cityCode: number, q: string, offset: number): Promise<PointsPage> {
  const params = new URLSearchParams({
    cityCode: String(cityCode),
    limit: String(POINTS_PAGE_SIZE),
    offset: String(offset),
  })
  if (q.trim()) params.set('q', q.trim())
  return fetchApi<PointsPage>(`/api/v1/delivery/points?${params}`)
}
