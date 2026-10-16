import { fetchApi } from './api'

export type CareChannel = 'phone' | 'telegram' | 'whatsapp'

export interface CareRequestBody {
  name: string
  phone: string
  channel: CareChannel
  consentPd: 'true'
  consentMarketing?: 'true' | 'false'
}

export async function submitCareRequest(body: CareRequestBody): Promise<void> {
  // Снимок без сервера: заявка «уходит» успешно, чтобы превью показывало финал
  if (import.meta.env.VITE_API_MODE === 'snapshot') return

  await fetchApi<{ ok: true }>('/api/v1/care-requests', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
