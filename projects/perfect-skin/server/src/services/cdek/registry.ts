import { cdekConfig, type CdekConfig } from './config.js'
import { CdekClient } from './client.js'
import { CdekHttp } from './http.js'

export interface CdekServices {
  config: CdekConfig
  client: CdekClient
}

function build(): CdekServices | null {
  if (cdekConfig === null) return null
  return { config: cdekConfig, client: new CdekClient(new CdekHttp(cdekConfig), cdekConfig) }
}

let services: CdekServices | null = build()

export function getCdek(): CdekServices | null {
  return services
}

export function setCdekForTests(next: CdekServices | null): void {
  services = next
}
