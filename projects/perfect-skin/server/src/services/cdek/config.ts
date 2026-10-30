import { createHash } from 'node:crypto'
import { hostname as osHostname } from 'node:os'

export type CdekPaidMode = 'tariff' | 'fixed'
export type CdekAutoCreate = 'off' | 'on_paid'

export interface CdekBox {
  lengthCm: number
  widthCm: number
  heightCm: number
  weightG: number
}

export interface CdekConfig {
  baseUrl: string
  isTest: boolean
  clientId: string
  clientSecret: string
  webhookSecret: string | null
  fromCityCode: number
  fromPostalCode: string | null
  fromAddress: string | null
  shipmentPoint: string | null
  tariffs: { pvz: number; postamat: number; courier: number }
  box: CdekBox
  itemWeightG: number
  paidMode: CdekPaidMode
  autoCreate: CdekAutoCreate
  orderNumberPrefix: string
}

export class CdekConfigError extends Error {}

const EDU_BASE_URL = 'https://api.edu.cdek.ru/v2'
const PROD_BASE_URL = 'https://api.cdek.ru/v2'
const DEFAULT_FROM_ADDRESS = 'Москва, Звенигородское шоссе, 3Ас1'
const BOX_PATTERN = /^\d{1,3}x\d{1,3}x\d{1,3}$/

export function parseCdekConfig(
  env: Record<string, string | undefined>,
  hostname: string = osHostname()
): CdekConfig | null {
  const clientId = env.PS_CDEK_CLIENT_ID ?? ''
  if (env.PS_CDEK === 'off' || clientId === '') return null

  const clientSecret = env.PS_CDEK_CLIENT_SECRET ?? ''
  if (clientSecret === '') {
    throw new CdekConfigError('PS_CDEK_CLIENT_SECRET пуст при включённой интеграции')
  }

  const baseUrl = env.PS_CDEK_BASE_URL || EDU_BASE_URL
  if (baseUrl !== EDU_BASE_URL && baseUrl !== PROD_BASE_URL) {
    throw new CdekConfigError('PS_CDEK_BASE_URL не из разрешённого списка')
  }
  const isTest = baseUrl === EDU_BASE_URL

  const webhookSecret = env.PS_CDEK_WEBHOOK_SECRET || null
  if (webhookSecret !== null && webhookSecret.length < 32) {
    throw new CdekConfigError('PS_CDEK_WEBHOOK_SECRET короче 32 символов')
  }

  const paidMode = env.PS_CDEK_PAID_DELIVERY || 'tariff'
  if (paidMode !== 'tariff' && paidMode !== 'fixed') {
    throw new CdekConfigError('PS_CDEK_PAID_DELIVERY: tariff или fixed')
  }

  const autoCreate = env.PS_CDEK_AUTO_CREATE || 'off'
  if (autoCreate !== 'off' && autoCreate !== 'on_paid') {
    throw new CdekConfigError('PS_CDEK_AUTO_CREATE: off или on_paid')
  }

  const defaultPrefix = isTest
    ? `T${createHash('sha1').update(hostname).digest('hex').slice(0, 6).toUpperCase()}-`
    : ''

  return {
    baseUrl,
    isTest,
    clientId,
    clientSecret,
    webhookSecret,
    fromCityCode: positiveInt(env, 'PS_CDEK_FROM_CITY_CODE', 44),
    fromPostalCode: env.PS_CDEK_FROM_POSTAL_CODE || null,
    fromAddress: env.PS_CDEK_FROM_ADDRESS || DEFAULT_FROM_ADDRESS,
    shipmentPoint: env.PS_CDEK_SHIPMENT_POINT || null,
    tariffs: {
      pvz: positiveInt(env, 'PS_CDEK_TARIFF_PVZ', 136),
      postamat: positiveInt(env, 'PS_CDEK_TARIFF_POSTAMAT', 368),
      courier: positiveInt(env, 'PS_CDEK_TARIFF_COURIER', 137),
    },
    box: parseBox(env.PS_CDEK_BOX || '20x15x10', positiveInt(env, 'PS_CDEK_BOX_WEIGHT_G', 150)),
    itemWeightG: positiveInt(env, 'PS_CDEK_ITEM_WEIGHT_G', 300),
    paidMode,
    autoCreate,
    orderNumberPrefix: env.PS_CDEK_ORDER_PREFIX || defaultPrefix,
  }
}

function positiveInt(env: Record<string, string | undefined>, name: string, fallback: number): number {
  const raw = env[name]
  const value = raw === undefined || raw === '' ? fallback : Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new CdekConfigError(`${name} должен быть целым числом больше нуля`)
  }
  return value
}

function parseBox(raw: string, weightG: number): CdekBox {
  if (!BOX_PATTERN.test(raw)) {
    throw new CdekConfigError('PS_CDEK_BOX: формат Д×Ш×В, например 20x15x10')
  }
  const [lengthCm, widthCm, heightCm] = raw.split('x').map(Number)
  if (lengthCm === 0 || widthCm === 0 || heightCm === 0) {
    throw new CdekConfigError('PS_CDEK_BOX: размеры должны быть больше нуля')
  }
  return { lengthCm, widthCm, heightCm, weightG }
}

export const cdekConfig = parseCdekConfig(process.env)
