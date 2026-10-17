import { fetchApi } from './api'

interface MarketingConsentResponse {
  consent: boolean
}

export async function fetchMarketingConsent(): Promise<boolean> {
  const result = await fetchApi<MarketingConsentResponse>('/api/v1/auth/me/marketing')
  return result.consent
}

export async function updateMarketingConsent(consent: boolean): Promise<boolean> {
  const result = await fetchApi<MarketingConsentResponse>('/api/v1/auth/me/marketing', {
    method: 'PATCH',
    body: JSON.stringify({ consent }),
  })
  return result.consent
}
