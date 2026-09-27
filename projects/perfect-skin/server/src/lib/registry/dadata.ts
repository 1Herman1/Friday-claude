/**
 * DaData API integration for checking parties by INN/OGRNIP.
 * Uses open registries to validate business information.
 */

export interface PartyLookup {
  status: 'found' | 'not_found' | 'unavailable'
  name?: string
  state?: string
  kind?: 'legal' | 'individual'
  okvedMain?: string | null
  okveds?: string[]
  ogrn?: string | null
}

interface DadataResponse {
  suggestions: Array<{
    data: {
      name: {
        short_with_opf?: string
        value?: string
      }
      state: {
        status?: string
      }
      type?: string
      okved?: string
      okveds?: Array<{ code?: string }>
      ogrn?: string
    }
  }>
}

/**
 * Parse DaData API response into normalized PartyLookup format.
 * Exported for testing.
 */
export function parsePartyResponse(json: unknown): PartyLookup {
  if (!json || typeof json !== 'object') {
    return { status: 'unavailable' }
  }

  const data = json as DadataResponse
  if (!Array.isArray(data.suggestions) || data.suggestions.length === 0) {
    return { status: 'not_found' }
  }

  try {
    const suggestion = data.suggestions[0]
    if (!suggestion?.data) {
      return { status: 'not_found' }
    }

    const partyData = suggestion.data
    const name = partyData.name?.short_with_opf || partyData.name?.value
    const state = partyData.state?.status
    const type = partyData.type
    const okvedMain = partyData.okved || null
    const okveds = (partyData.okveds || [])
      .map((o) => o.code)
      .filter((code): code is string => Boolean(code))
    const ogrn = partyData.ogrn || null

    if (!name || !state) {
      return { status: 'unavailable' }
    }

    return {
      status: 'found',
      name,
      state,
      kind:
        type === 'INDIVIDUAL' || type === 'IP'
          ? 'individual'
          : type === 'LEGAL'
            ? 'legal'
            : 'legal',
      okvedMain,
      okveds,
      ogrn,
    }
  } catch {
    return { status: 'unavailable' }
  }
}

/**
 * Look up a party (individual or legal entity) by INN.
 * Returns party data if found in DaData open registries.
 */
export async function lookupParty(inn: string, apiKey: string): Promise<PartyLookup> {
  // If no API key, return unavailable without making request
  if (!apiKey) {
    return { status: 'unavailable' }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Token ${apiKey}`,
        },
        body: JSON.stringify({
          query: inn,
          count: 1,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return { status: 'unavailable' }
      }

      const json = await response.json()
      return parsePartyResponse(json)
    } finally {
      clearTimeout(timeoutId)
    }
  } catch {
    // Any error: timeout, network, parsing — return unavailable
    return { status: 'unavailable' }
  }
}
