// Живая проверка API СДЭК. Запуск: npm run cdek:smoke --workspace=@ps/server
// Флаги: --create (тестовый заказ, накладная, удаление), --shapes (только типы полей ответов, без значений).
// Токен и персональные данные не печатаются. Код выхода 1 при любом провале.
import { z } from 'zod'
import { parseCdekConfig, type CdekConfig } from '../src/services/cdek/config.js'
import { CdekHttp } from '../src/services/cdek/http.js'
import {
  CdekClient,
  type CdekCreateOrderPayload,
  type CdekPackage,
} from '../src/services/cdek/client.js'
import { listResponseSchema } from '../src/services/cdek/schemas.js'

const MOSCOW = 44
const SAINT_PETERSBURG = 137
const CODE_PATTERN = /^[A-Z0-9-]{2,20}$/
const POINTS_TIMEOUT_MS = 20_000
const POINTS_MAX_BYTES = 30_000_000
const POLL_INTERVAL_MS = 2_000
const ORDER_POLL_ATTEMPTS = 15
const PRINT_POLL_ATTEMPTS = 5

const flags = new Set(process.argv.slice(2))
const withCreate = flags.has('--create')
const withShapes = flags.has('--shapes')

class SmokeFailure extends Error {}

const receptionRef = z.object({ code: z.string(), is_reception: z.boolean().optional() })

function check(condition: boolean, message: string): void {
  if (!condition) throw new SmokeFailure(message)
}

function report(step: string, detail: string): void {
  console.log(`[ok] ${step}: ${detail}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function defaultPackage(cfg: CdekConfig): CdekPackage {
  return {
    weight: cfg.box.weightG + cfg.itemWeightG,
    length: cfg.box.lengthCm,
    width: cfg.box.widthCm,
    height: cfg.box.heightCm,
  }
}

function shapeOf(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.length === 0 ? [] : [shapeOf(value[0], depth + 1)]
  if (typeof value !== 'object' || value === null) return value === null ? 'null' : typeof value
  if (depth >= 3) return '{…}'
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shapeOf(inner, depth + 1)]))
}

function printShape(label: string, value: unknown): void {
  console.log(`--shapes ${label}:\n${JSON.stringify(shapeOf(value), null, 2)}`)
}

async function findReceptionPoint(http: CdekHttp): Promise<string> {
  const raw = await http.request('GET', '/deliverypoints', {
    query: { city_code: MOSCOW, country_code: 'RU', type: 'ALL' },
    schema: listResponseSchema,
    timeoutMs: POINTS_TIMEOUT_MS,
    maxBytes: POINTS_MAX_BYTES,
  })
  const reception = raw.flatMap((item) => {
    const parsed = receptionRef.safeParse(item)
    return parsed.success && parsed.data.is_reception === true ? [parsed.data.code] : []
  })
  check(reception.length > 0, 'в Москве нет пункта приёма (is_reception)')
  return reception[0]
}

async function waitForCdekNumber(client: CdekClient, http: CdekHttp, uuid: string, shapes: boolean): Promise<void> {
  for (let attempt = 0; attempt < ORDER_POLL_ATTEMPTS; attempt += 1) {
    const info = await client.getOrder(uuid)
    if (info.requestState === 'INVALID') {
      throw new SmokeFailure(`СДЭК отклонил тестовый заказ: ${info.requestErrors.join('; ')}`)
    }
    if (info.cdekNumber !== null) {
      if (shapes) {
        printShape('GET /orders/{uuid}', await http.request('GET', `/orders/${encodeURIComponent(uuid)}`, { schema: z.unknown() }))
      }
      return
    }
    await sleep(POLL_INTERVAL_MS)
  }
  throw new SmokeFailure('номер СДЭК не появился за 30 секунд')
}

async function downloadWaybill(client: CdekClient, printUuid: string): Promise<Buffer> {
  for (let attempt = 0; attempt < PRINT_POLL_ATTEMPTS; attempt += 1) {
    const print = await client.getPrint('waybill', printUuid)
    check(print.lastStatus !== 'INVALID', 'СДЭК не смог сформировать накладную')
    if (print.url !== null) return client.downloadPdf(print.url)
    await sleep(POLL_INTERVAL_MS)
  }
  throw new SmokeFailure('накладная не готова за 10 секунд')
}

async function createAndCheck(client: CdekClient, http: CdekHttp, cfg: CdekConfig): Promise<void> {
  const shipmentPoint = await findReceptionPoint(http)
  const spbPoints = await client.listPoints(SAINT_PETERSBURG)
  check(spbPoints.length > 0, 'в Санкт-Петербурге нет ПВЗ для тестового заказа')

  const pkg = defaultPackage(cfg)
  const payload: CdekCreateOrderPayload = {
    type: 1,
    number: `${cfg.orderNumberPrefix}SMOKE-${Date.now()}`,
    tariff_code: cfg.tariffs.pvz,
    shipment_point: shipmentPoint,
    delivery_point: spbPoints[0].code,
    recipient: { name: 'Smoke Test', phones: [{ number: '+79000000000' }] },
    delivery_recipient_cost: { value: 0 },
    packages: [
      {
        number: '1',
        ...pkg,
        items: [
          {
            name: 'Smoke item',
            ware_key: 'SMOKE',
            payment: { value: 0 },
            cost: 1,
            weight: cfg.itemWeightG,
            amount: 1,
          },
        ],
      },
    ],
  }

  const { uuid } = await client.createOrder(payload)
  try {
    await waitForCdekNumber(client, http, uuid, withShapes)
    report('4. тестовый заказ принят, трек получен', 'номер СДЭК есть')

    const printUuid = await client.createPrint('waybill', uuid)
    const pdf = await downloadWaybill(client, printUuid)
    check(pdf.subarray(0, 4).toString('latin1') === '%PDF', 'накладная не начинается с %PDF')
    report('5. накладная', `PDF, ${pdf.length} байт`)
  } finally {
    await http.request('DELETE', `/orders/${encodeURIComponent(uuid)}`, { schema: z.unknown() })
    report('6. тестовый заказ удалён', 'ok')
  }
}

async function main(): Promise<void> {
  const cfg = parseCdekConfig(process.env)
  if (cfg === null) throw new SmokeFailure('интеграция выключена: пустой PS_CDEK_CLIENT_ID или PS_CDEK=off')

  const http = new CdekHttp(cfg)
  const client = new CdekClient(http, cfg)

  const cities = await client.suggestCities('Москва')
  check(cities.some((city) => city.code === MOSCOW), 'в ответе поиска нет Москвы с кодом 44')
  report('1. токен получен, поиск города', 'Москва = 44')

  const points = await client.listPoints(MOSCOW)
  check(points.length > 0, 'список ПВЗ Москвы пуст')
  const badCodes = points.filter((point) => !CODE_PATTERN.test(point.code)).length
  check(badCodes === 0, `${badCodes} кодов ПВЗ не проходят ${CODE_PATTERN.source}`)
  report('2. ПВЗ Москвы', `${points.length} шт., коды в формате`)

  const tariffs = await client.tariffList(SAINT_PETERSBURG, defaultPackage(cfg))
  const received = new Set(tariffs.map((tariff) => tariff.tariffCode))
  const missing = [cfg.tariffs.pvz, cfg.tariffs.courier, cfg.tariffs.postamat].filter((code) => !received.has(code))
  report('3. тарифы Москва → СПб', `получено ${received.size}; нет из настроенных: ${missing.join(', ') || 'нет'}`)

  if (withShapes) {
    printShape('GET /location/suggest/cities', await http.request('GET', '/location/suggest/cities', {
      query: { name: 'Москва', country_code: 'RU' },
      schema: z.unknown(),
    }))
    printShape('GET /deliverypoints', await http.request('GET', '/deliverypoints', {
      query: { city_code: MOSCOW, country_code: 'RU', type: 'ALL', is_handout: true },
      schema: z.unknown(),
      timeoutMs: POINTS_TIMEOUT_MS,
      maxBytes: POINTS_MAX_BYTES,
    }))
    printShape('POST /calculator/tarifflist', await http.request('POST', '/calculator/tarifflist', {
      body: {
        type: 1,
        currency: 1,
        lang: 'rus',
        from_location: { code: cfg.fromCityCode },
        to_location: { code: SAINT_PETERSBURG },
        packages: [defaultPackage(cfg)],
      },
      schema: z.unknown(),
    }))
  }

  if (withCreate) await createAndCheck(client, http, cfg)
}

try {
  await main()
  console.log('smoke: все проверки прошли')
} catch (error) {
  console.error(`smoke: провал — ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
