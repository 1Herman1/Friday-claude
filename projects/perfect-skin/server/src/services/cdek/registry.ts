import type { CdekConfig } from './config.js'
import { CdekClient } from './client.js'
import { CdekHttp, type CdekLog } from './http.js'
import type { CdekOrderSync } from './order-sync.js'

export interface CdekServices {
  config: CdekConfig
  client: CdekClient
}

let services: CdekServices | null = null

export function initCdek(config: CdekConfig | null, log?: CdekLog): CdekServices | null {
  services = config === null ? null : { config, client: new CdekClient(new CdekHttp(config, fetch, Date.now, log), config) }
  return services
}

export function getCdek(): CdekServices | null {
  return services
}

export function setCdekForTests(next: CdekServices | null): void {
  services = next
}

let sync: CdekOrderSync | null = null

export function setCdekSync(next: CdekOrderSync | null): void {
  sync = next
}

export function getCdekSync(): CdekOrderSync | null {
  return sync
}
