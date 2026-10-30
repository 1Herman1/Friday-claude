import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { parseCdekConfig, type CdekConfig } from '../services/cdek/config.js'
import type { CdekClient, CdekCreateOrderPayload, CdekOrderInfo } from '../services/cdek/client.js'
import { CdekRejectedError } from '../services/cdek/http.js'
import { CdekOrderSync } from '../services/cdek/order-sync.js'
import type { CdekServices } from '../services/cdek/registry.js'
import { adminOrderService } from '../services/admin-order.service.js'

const EMAIL_DOMAIN = '@cdek-sync.ps-test.local'
const NUMBER_PREFIX = 'CDEKT-'
const cfg = parseCdekConfig({ PS_CDEK_CLIENT_ID: 'id', PS_CDEK_CLIENT_SECRET: 'secret' }, 'host') as CdekConfig

const notifier = { onCdekProblem: vi.fn(async (_orderId: string, _reason: string) => {}) }
const mail = { send: vi.fn(async () => {}), sendPlain: vi.fn(async (_to: string, _subject: string, _text: string) => {}) }
const log = { info: () => {}, warn: () => {} }

const createOrder = vi.fn(async (_payload: CdekCreateOrderPayload) => ({ uuid: randomUUID() }))
const getOrder = vi.fn(async (uuid: string): Promise<CdekOrderInfo> => infoFor(uuid))
const findOrderByNumber = vi.fn(async (_number: string): Promise<CdekOrderInfo | null> => null)

const createPrint = vi.fn(async (_kind: 'waybill' | 'barcode', _uuid: string) => 'print-1')
const getPrint = vi.fn(async (_kind: 'waybill' | 'barcode', _printUuid: string) => ({ url: null as string | null, lastStatus: null as string | null }))
const downloadPdf = vi.fn(async (_url: string) => Buffer.from('%PDF-1.4 test'))

const client = { createOrder, getOrder, findOrderByNumber, createPrint, getPrint, downloadPdf } as unknown as CdekClient
const services: CdekServices = { config: cfg, client }

const scripted = new Map<string, CdekOrderInfo>()

function infoFor(uuid: string): CdekOrderInfo {
  return scripted.get(uuid) ?? { uuid, number: null, cdekNumber: null, requestState: 'WAITING', requestErrors: [], statuses: [] }
}

function makeSync(): CdekOrderSync {
  return new CdekOrderSync({
    cdek: services,
    notifier,
    mail,
    log,
    publicUrl: 'https://perfect-skin.example',
    sleep: async () => {},
  })
}

async function makeOrder(
  options: { stateCreatedAt?: Date; state?: 'creating' | null; paymentStatus?: 'pending' | 'paid' } = {}
): Promise<{ id: string; number: string }> {
  const suffix = randomUUID().slice(0, 8)
  const user = await db.user.create({ data: { name: 'Тест', email: `cdek-${suffix}${EMAIL_DOMAIN}` } })
  const order = await db.order.create({
    data: {
      number: `${NUMBER_PREFIX}${suffix}`,
      userId: user.id,
      status: 'new',
      deliveryMethod: 'cdek_courier',
      deliveryAddress: { street: 'Тверская', house: '1' },
      cdekCityCode: 44,
      cdekTariffCode: 137,
      recipientName: 'Тест Тестович',
      recipientPhone: '+79990000001',
      subtotal: 100000,
      total: 100000,
      paymentStatus: options.paymentStatus ?? 'paid',
      cdekState: options.state ?? null,
      cdekRequestedAt: options.stateCreatedAt ?? null,
    },
  })
  return { id: order.id, number: order.number }
}

beforeEach(() => {
  createOrder.mockClear()
  getOrder.mockClear()
  findOrderByNumber.mockClear()
  notifier.onCdekProblem.mockClear()
  mail.sendPlain.mockClear()
  scripted.clear()
  getPrint.mockReset()
  getPrint.mockResolvedValue({ url: null, lastStatus: null })
  createPrint.mockClear()
  findOrderByNumber.mockImplementation(async () => null)
  createOrder.mockImplementation(async () => ({ uuid: randomUUID() }))
  getOrder.mockImplementation(async (uuid: string) => infoFor(uuid))
})

afterAll(async () => {
  await db.order.deleteMany({ where: { number: { startsWith: NUMBER_PREFIX } } })
  await db.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } })
})

describe('CDEK order sync (с базой)', () => {
  it('два одновременных submit → ровно один createOrder', async () => {
    const order = await makeOrder()
    const sync = makeSync()
    createOrder.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return { uuid: randomUUID() }
    })

    const results = await Promise.allSettled([sync.submit(order.id, 'manager'), sync.submit(order.id, 'manager')])

    expect(createOrder).toHaveBeenCalledTimes(1)
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect((rejected[0].reason as ApiError).code).toBe('CDEK_ALREADY_SUBMITTED')
  })

  it('неоплаченный заказ: submit → ORDER_NOT_PAID, в СДЭК ничего не уходит, состояние не меняется', async () => {
    const order = await makeOrder({ paymentStatus: 'pending' })
    const sync = makeSync()

    await expect(sync.submit(order.id, 'manager')).rejects.toMatchObject({ status: 409, code: 'ORDER_NOT_PAID' })
    expect(createOrder).not.toHaveBeenCalled()
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).cdekState).toBeNull()
  })

  it('allowUnpaid (force супер-админа) передаёт неоплаченный заказ', async () => {
    const order = await makeOrder({ paymentStatus: 'pending' })
    const sync = makeSync()

    await sync.submit(order.id, 'manager', { allowUnpaid: true })

    expect(createOrder).toHaveBeenCalledTimes(1)
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).cdekState).toBe('accepted')
  })

  it('state accepted и created без uuid/номера в базе не записываются', async () => {
    const order = await makeOrder()
    await expect(db.order.update({ where: { id: order.id }, data: { cdekState: 'accepted' } })).rejects.toThrow()
    await expect(db.order.update({ where: { id: order.id }, data: { cdekState: 'created' } })).rejects.toThrow()
  })

  it('invalid от СДЭК → 422 и повторная передача разрешена', async () => {
    const order = await makeOrder()
    const sync = makeSync()
    createOrder.mockRejectedValueOnce(new CdekRejectedError(400, ['Неверный адрес']))

    await expect(sync.submit(order.id, 'manager')).rejects.toMatchObject({ status: 422, code: 'CDEK_REJECTED' })
    const invalid = await db.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(invalid.cdekState).toBe('invalid')
    expect(invalid.cdekError).toBe('Неверный адрес')

    createOrder.mockImplementation(async () => ({ uuid: randomUUID() }))
    getOrder.mockImplementation(async (uuid: string) => ({
      uuid, number: null, cdekNumber: 'CDK-1', requestState: 'SUCCESSFUL', requestErrors: [], statuses: [],
    }))
    await sync.submit(order.id, 'manager')
    const created = await db.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(created.cdekState).toBe('created')
    expect(created.cdekNumber).toBe('CDK-1')
    expect(created.deliveryTrackNumber).toBe('CDK-1')
  })

  it('зависший creating: сначала findOrderByNumber, а не новый createOrder', async () => {
    const order = await makeOrder({ state: 'creating', stateCreatedAt: new Date(Date.now() - 10 * 60_000) })
    const sync = makeSync()
    findOrderByNumber.mockImplementation(async (number: string) => ({
      uuid: 'adopted-uuid', number, cdekNumber: 'CDK-ADOPT', requestState: 'SUCCESSFUL', requestErrors: [], statuses: [],
    }))

    await sync.submit(order.id, 'manager')

    expect(findOrderByNumber).toHaveBeenCalledWith(cfg.orderNumberPrefix + order.number)
    expect(createOrder).not.toHaveBeenCalled()
    const row = await db.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(row.cdekState).toBe('created')
    expect(row.cdekUuid).toBe('adopted-uuid')
  })

  it('письмо с треком уходит ровно один раз при повторных применениях', async () => {
    const order = await makeOrder()
    const sync = makeSync()
    const info: CdekOrderInfo = { uuid: randomUUID(), number: null, cdekNumber: 'CDK-MAIL', requestState: 'SUCCESSFUL', requestErrors: [], statuses: [] }
    await db.order.update({ where: { id: order.id }, data: { cdekUuid: info.uuid, cdekState: 'accepted' } })

    await sync.applyOrderInfo(order.id, info, 'poll')
    await sync.applyOrderInfo(order.id, info, 'poll')

    expect(mail.sendPlain).toHaveBeenCalledTimes(1)
    const text = mail.sendPlain.mock.calls[0][2]
    expect(text).toContain('CDK-MAIL')
    expect(text).not.toMatch(/бонус|скидк|акци/i)
  })

  it('вебхук: чужой uuid → ignored без запроса к СДЭК; свой → refreshed; повтор в 30 с → debounced', async () => {
    const order = await makeOrder()
    const sync = makeSync()
    const uuid = randomUUID()
    await db.order.update({ where: { id: order.id }, data: { cdekUuid: uuid, cdekState: 'accepted' } })

    expect(await sync.handleWebhook({ type: 'ORDER_STATUS', uuid: randomUUID() })).toBe('ignored')
    expect(getOrder).not.toHaveBeenCalled()

    expect(await sync.handleWebhook({ type: 'ORDER_STATUS', uuid })).toBe('refreshed')
    expect(getOrder).toHaveBeenCalledTimes(1)
    expect(getOrder).toHaveBeenCalledWith(uuid)

    expect(await sync.handleWebhook({ type: 'ORDER_STATUS', uuid })).toBe('debounced')
    expect(getOrder).toHaveBeenCalledTimes(1)
  })

  it('автосоздание после оплаты выключено по умолчанию: createOrder не вызывается', async () => {
    const order = await makeOrder()
    await makeSync().onOrderPaid(order.id)
    expect(createOrder).not.toHaveBeenCalled()
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).cdekState).toBeNull()
  })

  it('DELIVERED переводит в delivered с датой вручения из СДЭК; повтор ничего не меняет', async () => {
    const order = await makeOrder()
    const sync = makeSync()
    const uuid = randomUUID()
    const deliveredAt = new Date('2026-10-29T09:15:00Z')
    await db.order.update({ where: { id: order.id }, data: { cdekUuid: uuid, cdekState: 'accepted' } })
    const info: CdekOrderInfo = {
      uuid, number: null, cdekNumber: 'CDK-DLV', requestState: 'SUCCESSFUL', requestErrors: [],
      statuses: [{ code: 'DELIVERED', name: 'Вручен', city: 'Москва', at: deliveredAt }],
    }

    await sync.applyOrderInfo(order.id, info, 'webhook')
    await sync.applyOrderInfo(order.id, info, 'poll')

    const row = await db.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(row.status).toBe('delivered')
    expect(row.deliveredAt?.getTime()).toBe(deliveredAt.getTime())
    expect(await db.cdekStatusEvent.count({ where: { orderId: order.id } })).toBe(1)
  })

  it('отменённый заказ: DELIVERED из вебхука не выводит его из cancelled', async () => {
    const order = await makeOrder()
    await db.order.update({ where: { id: order.id }, data: { status: 'cancelled' } })
    const sync = makeSync()
    const uuid = randomUUID()
    await db.order.update({ where: { id: order.id }, data: { cdekUuid: uuid, cdekState: 'accepted' } })
    const info: CdekOrderInfo = {
      uuid, number: null, cdekNumber: 'CDK-CXL', requestState: 'SUCCESSFUL', requestErrors: [],
      statuses: [{ code: 'DELIVERED', name: 'Вручен', city: 'Москва', at: new Date('2026-10-29T09:15:00Z') }],
    }

    await sync.applyOrderInfo(order.id, info, 'webhook')

    const row = await db.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(row.status).toBe('cancelled')
    expect(row.deliveredAt).toBeNull()
  })

  it('NOT_DELIVERED: статус не меняем, уведомление менеджеру ровно один раз', async () => {
    const order = await makeOrder()
    const sync = makeSync()
    const uuid = randomUUID()
    await db.order.update({ where: { id: order.id }, data: { cdekUuid: uuid, cdekState: 'accepted' } })
    const info: CdekOrderInfo = {
      uuid, number: null, cdekNumber: 'CDK-ND', requestState: 'SUCCESSFUL', requestErrors: [],
      statuses: [{ code: 'NOT_DELIVERED', name: 'Не вручен', city: null, at: new Date('2026-10-29T10:00:00Z') }],
    }

    await sync.applyOrderInfo(order.id, info, 'poll')
    await sync.applyOrderInfo(order.id, info, 'poll')

    const row = await db.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(row.status).toBe('new')
    expect(notifier.onCdekProblem).toHaveBeenCalledTimes(1)
    expect(notifier.onCdekProblem.mock.calls[0][1]).not.toMatch(/Тест|\+7|Тверская/)
  })
})

describe('CDEK печать и ручной трек (с базой)', () => {
  it('накладная: опрос до готовности, затем PDF', async () => {
    const order = await makeOrder()
    const uuid = randomUUID()
    await db.order.update({ where: { id: order.id }, data: { cdekUuid: uuid, cdekNumber: 'CDK-PRN', cdekState: 'created' } })
    getPrint
      .mockResolvedValueOnce({ url: null, lastStatus: null })
      .mockResolvedValueOnce({ url: 'https://api.edu.cdek.ru/v2/print/x.pdf', lastStatus: 'READY' })

    const pdf = await makeSync().print(order.id, 'waybill')

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect(createPrint).toHaveBeenCalledWith('waybill', uuid)
    expect(getPrint).toHaveBeenCalledTimes(2)
  })

  it('печать после INVALID от СДЭК → PRINT_FAILED', async () => {
    const order = await makeOrder()
    await db.order.update({ where: { id: order.id }, data: { cdekUuid: randomUUID(), cdekNumber: 'CDK-PRF', cdekState: 'created' } })
    getPrint.mockResolvedValueOnce({ url: null, lastStatus: 'INVALID' })

    await expect(makeSync().print(order.id, 'barcode')).rejects.toMatchObject({ status: 409, code: 'PRINT_FAILED' })
  })

  it('печать до создания в СДЭК → 409', async () => {
    const order = await makeOrder()
    await expect(makeSync().print(order.id, 'waybill')).rejects.toMatchObject({ status: 409, code: 'CDEK_NOT_APPLICABLE' })
  })

  it('ручной трек при номере СДЭК → 409 TRACK_MANAGED_BY_CDEK', async () => {
    const order = await makeOrder()
    await db.order.update({ where: { id: order.id }, data: { cdekNumber: 'CDK-TRK', deliveryTrackNumber: 'CDK-TRK' } })

    await expect(
      adminOrderService.updateOrder(order.id, { deliveryTrackNumber: 'MANUAL-1' }, 'super_admin')
    ).rejects.toMatchObject({ status: 409, code: 'TRACK_MANAGED_BY_CDEK' })
  })
})

describe('CDEK: зависшая передача и вебхук', () => {
  it('сброс creating не трогает свежую передачу, а зависшую сбрасывает', async () => {
    const fresh = await makeOrder({ state: 'creating', stateCreatedAt: new Date() })
    const stale = await makeOrder({ state: 'creating', stateCreatedAt: new Date(Date.now() - 20 * 60_000) })
    const sync = makeSync() as unknown as { resolveStaleCreating(orderId: string, number: string): Promise<void> }

    await sync.resolveStaleCreating(fresh.id, fresh.number)
    expect((await db.order.findUniqueOrThrow({ where: { id: fresh.id } })).cdekState).toBe('creating')
    expect(notifier.onCdekProblem).not.toHaveBeenCalled()

    await sync.resolveStaleCreating(stale.id, stale.number)
    expect((await db.order.findUniqueOrThrow({ where: { id: stale.id } })).cdekState).toBeNull()
    expect(notifier.onCdekProblem).toHaveBeenCalledTimes(1)
  })

  describe('регистрация вебхука', () => {
    const secret = 'w'.repeat(40)
    const hooks = () => {
      const listWebhooks = vi.fn(async () => [])
      const createWebhook = vi.fn(async (_url: string) => {})
      const deleteWebhook = vi.fn(async (_uuid: string) => {})
      return { listWebhooks, createWebhook, deleteWebhook }
    }
    const syncWith = (flag: string | undefined, client: ReturnType<typeof hooks>) =>
      new CdekOrderSync({
        cdek: {
          config: parseCdekConfig(
            { PS_CDEK_CLIENT_ID: 'id', PS_CDEK_CLIENT_SECRET: 'secret', PS_CDEK_WEBHOOK_SECRET: secret, ...(flag ? { PS_CDEK_WEBHOOK: flag } : {}) },
            'host'
          ) as CdekConfig,
          client: client as unknown as CdekClient,
        },
        notifier,
        mail,
        log,
        publicUrl: 'https://perfect-skin.example',
      })

    it('без PS_CDEK_WEBHOOK=on вебхук у СДЭК не трогаем', async () => {
      const client = hooks()
      await syncWith(undefined, client).ensureWebhook()
      expect(client.listWebhooks).not.toHaveBeenCalled()
      expect(client.createWebhook).not.toHaveBeenCalled()
    })

    it('PS_CDEK_WEBHOOK=on регистрирует вебхук с секретом в пути', async () => {
      const client = hooks()
      await syncWith('on', client).ensureWebhook()
      expect(client.createWebhook).toHaveBeenCalledWith(`https://perfect-skin.example/api/v1/delivery/cdek/webhook/${secret}`)
    })
  })
})
