import type { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { db, type $Enums } from '../../lib/db.js'
import { ApiError } from '../../lib/errors.js'
import { TtlCache } from '../../lib/ttl-cache.js'
import type { MailSender } from '../mail/index.js'
import { changeOrderStatus } from '../order-lifecycle.service.js'
import type { CdekConfig } from './config.js'
import type { CdekClient, CdekCreateOrderPayload, CdekOrderInfo, CdekStatus } from './client.js'
import { CdekRejectedError, CdekUnavailableError } from './http.js'
import type { CdekServices } from './registry.js'
import { effectOf, FORWARD_FROM, type ForwardStatus } from './status-map.js'
import type { CdekWebhookBody } from './schemas.js'

export interface OrderItemForCdek {
  productVariantId: string
  productName: string
  volumeLabel: string
  price: number
  quantity: number
  weightGrams: number | null
}

export interface OrderForCdek {
  number: string
  deliveryMethod: 'cdek_pvz' | 'cdek_courier' | 'pickup'
  cdekPvzCode: string | null
  cdekCityCode: number | null
  cdekTariffCode: number | null
  deliveryAddress: unknown
  recipientName: string
  recipientPhone: string
  items: OrderItemForCdek[]
}

const courierAddressSchema = z.object({
  street: z.string().min(1),
  house: z.string().min(1),
  apartment: z.string().nullish(),
  postalCode: z.string().nullish(),
})

export const CDEK_WEBHOOK_PATH = '/api/v1/delivery/cdek/webhook/'

const CLAIM_STALE_MS = 5 * 60_000
const ADOPT_STALE_MS = 15 * 60_000
const POLL_ATTEMPTS = 3
const POLL_PAUSE_MS = 1_500
const SYNC_WINDOW_MS = 60 * 24 * 60 * 60_000
const SWEEP_INTERVAL_MS = 20 * 60_000
const WEBHOOK_DEBOUNCE_MS = 30_000
const ERROR_TEXT_MAX = 1000
const SYNC_BATCH = 50
const PRINT_CACHE_MS = 60 * 60_000
const PRINT_POLLS = 5
const PRINT_PAUSE_MS = 2_000

type CdekSyncState = $Enums.CdekSyncState
export type CdekSource = 'webhook' | 'poll' | 'manual' | 'submit'

export interface CdekSubmitOptions {
  allowUnpaid?: boolean
}

export interface CdekProblemNotifier {
  onCdekProblem(orderId: string, reason: string): Promise<void>
}

export interface CdekSyncDeps {
  cdek: CdekServices
  notifier: CdekProblemNotifier
  mail: MailSender
  log: Pick<FastifyBaseLogger, 'info' | 'warn'>
  publicUrl: string
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

const notConfigured = (): ApiError =>
  new ApiError(409, 'CDEK_NOT_CONFIGURED', 'У заказа нет города или тарифа СДЭК, передайте заказ вручную')

export function buildCreateOrderPayload(order: OrderForCdek, cfg: CdekConfig): CdekCreateOrderPayload {
  if (order.cdekTariffCode === null) throw notConfigured()
  const shipping = order.deliveryMethod === 'cdek_pvz' ? pickupTarget(order) : courierTarget(order)
  const itemsGrams = order.items.reduce((sum, item) => sum + (item.weightGrams ?? cfg.itemWeightG) * item.quantity, 0)

  return {
    type: 1,
    number: cfg.orderNumberPrefix + order.number,
    tariff_code: order.cdekTariffCode,
    ...(cfg.shipmentPoint
      ? { shipment_point: cfg.shipmentPoint }
      : {
          from_location: {
            code: cfg.fromCityCode,
            address: cfg.fromAddress ?? undefined,
            postal_code: cfg.fromPostalCode ?? undefined,
          },
        }),
    ...shipping,
    recipient: { name: order.recipientName, phones: [{ number: order.recipientPhone }] },
    delivery_recipient_cost: { value: 0 },
    packages: [
      {
        number: '1',
        weight: cfg.box.weightG + itemsGrams,
        length: cfg.box.lengthCm,
        width: cfg.box.widthCm,
        height: cfg.box.heightCm,
        items: order.items.map((item) => ({
          name: `${item.productName} ${item.volumeLabel}`.slice(0, 255),
          ware_key: item.productVariantId,
          payment: { value: 0 },
          cost: item.price / 100,
          weight: item.weightGrams ?? cfg.itemWeightG,
          amount: item.quantity,
        })),
      },
    ],
  }
}

function pickupTarget(order: OrderForCdek): Pick<CdekCreateOrderPayload, 'delivery_point'> {
  if (!order.cdekPvzCode) throw notConfigured()
  return { delivery_point: order.cdekPvzCode }
}

function courierTarget(order: OrderForCdek): Pick<CdekCreateOrderPayload, 'to_location'> {
  const address = courierAddressSchema.safeParse(order.deliveryAddress)
  if (order.cdekCityCode === null || !address.success) throw notConfigured()
  const { street, house, apartment, postalCode } = address.data
  return {
    to_location: {
      code: order.cdekCityCode,
      address: `${street}, д. ${house}${apartment ? `, кв. ${apartment}` : ''}`,
      postal_code: postalCode ?? undefined,
    },
  }
}

const APPLY_SELECT = {
  number: true,
  status: true,
  cdekState: true,
  cdekUuid: true,
  cdekNumber: true,
  cdekStatusCode: true,
  cdekStatusAt: true,
  recipientEmail: true,
  user: { select: { email: true } },
} as const

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export class CdekOrderSync {
  private readonly debounce = new TtlCache<true>(WEBHOOK_DEBOUNCE_MS, 5000)
  private readonly printUuids = new TtlCache<string>(PRINT_CACHE_MS, 1000)
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(private readonly deps: CdekSyncDeps) {
    this.now = deps.now ?? Date.now
    this.sleep = deps.sleep ?? defaultSleep
  }

  private get cfg(): CdekConfig {
    return this.deps.cdek.config
  }

  private get client(): CdekClient {
    return this.deps.cdek.client
  }

  async submit(orderId: string, actor: 'manager' | 'auto', options: CdekSubmitOptions = {}): Promise<void> {
    const before = await db.order.findUnique({ where: { id: orderId }, select: { cdekState: true } })
    if (before === null) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден')

    const claim = await db.order.updateMany({
      where: {
        id: orderId,
        deliveryMethod: { not: 'pickup' },
        status: { notIn: ['cancelled', 'delivered'] },
        ...(options.allowUnpaid ? {} : { paymentStatus: 'paid' }),
        OR: [
          { cdekState: null },
          { cdekState: 'invalid' },
          { cdekState: 'creating', cdekRequestedAt: { lt: new Date(this.now() - CLAIM_STALE_MS) } },
        ],
      },
      data: { cdekState: 'creating', cdekRequestedAt: new Date(this.now()), cdekError: null },
    })
    if (claim.count === 0) throw await this.refusalFor(orderId, options)

    const order = await this.loadForCdek(orderId)
    const prefixed = this.cfg.orderNumberPrefix + order.number
    if (before.cdekState === 'creating') {
      const found = await this.client.findOrderByNumber(prefixed)
      if (found !== null && found.number === prefixed) {
        await this.adopt(orderId, found, 'submit')
        return
      }
    }

    let payload: CdekCreateOrderPayload
    try {
      payload = buildCreateOrderPayload(order, this.cfg)
    } catch (error) {
      await this.releaseClaim(orderId)
      throw error
    }

    try {
      const { uuid } = await this.client.createOrder(payload)
      await db.order.update({
        where: { id: orderId },
        data: { cdekState: 'accepted', cdekUuid: uuid, cdekError: null },
      })
      await this.pollForNumber(orderId, uuid)
    } catch (error) {
      if (error instanceof CdekRejectedError) {
        await this.markInvalid(orderId, error.messages, 'creating')
        throw new ApiError(422, 'CDEK_REJECTED', 'СДЭК отклонил заказ', { messages: error.messages })
      }
      if (error instanceof CdekUnavailableError) {
        throw new ApiError(503, 'CDEK_UNAVAILABLE', 'СДЭК не ответил, повторите через 5 минут')
      }
      throw error
    }
    this.deps.log.info({ orderId, actor }, 'СДЭК: заказ передан')
  }

  async refresh(orderId: string, source: CdekSource): Promise<void> {
    const order = await db.order.findUnique({ where: { id: orderId }, select: { cdekUuid: true } })
    if (order?.cdekUuid == null) return
    await this.applyOrderInfo(orderId, await this.client.getOrder(order.cdekUuid), source)
  }

  async applyOrderInfo(orderId: string, info: CdekOrderInfo, source: CdekSource): Promise<void> {
    const order = await db.order.findUnique({ where: { id: orderId }, select: APPLY_SELECT })
    if (order === null) return

    if (info.cdekNumber !== null) {
      if (order.cdekState !== 'created') {
        await db.order.update({
          where: { id: orderId },
          data: {
            cdekState: 'created',
            cdekNumber: info.cdekNumber,
            cdekUuid: order.cdekUuid ?? info.uuid,
            deliveryTrackNumber: info.cdekNumber,
            cdekError: null,
          },
        })
      }
      await this.sendTrackEmail(orderId)
    } else if (info.requestState === 'INVALID') {
      await this.markInvalid(orderId, info.requestErrors, order.cdekState)
    }

    const statuses = [...info.statuses].sort((a, b) => a.at.getTime() - b.at.getTime())
    if (statuses.length > 0) {
      await db.cdekStatusEvent.createMany({
        data: statuses.map((status) => ({
          orderId,
          code: status.code,
          name: status.name,
          city: status.city,
          occurredAt: status.at,
          source,
        })),
        skipDuplicates: true,
      })
    }
    const latest = statuses.at(-1)
    if (latest !== undefined) await this.applyLatest(orderId, order.cdekStatusCode, order.cdekStatusAt, latest)
  }

  async handleWebhook(body: CdekWebhookBody): Promise<'ignored' | 'refreshed' | 'debounced'> {
    if (body.type !== 'ORDER_STATUS') return 'ignored'
    const order = await this.findByWebhook(body)
    if (order === null) return 'ignored'
    if (this.debounce.get(order.id) !== undefined) return 'debounced'
    this.debounce.set(order.id, true)
    await this.refresh(order.id, 'webhook')
    return 'refreshed'
  }

  async syncPending(limit: number = SYNC_BATCH): Promise<{ checked: number; failed: number }> {
    let checked = 0
    let failed = 0

    const pending = await db.order.findMany({
      where: {
        cdekState: { in: ['accepted', 'created'] },
        status: { notIn: ['delivered', 'cancelled'] },
        createdAt: { gte: new Date(this.now() - SYNC_WINDOW_MS) },
      },
      orderBy: { cdekStatusAt: { sort: 'asc', nulls: 'first' } },
      take: limit,
      select: { id: true },
    })
    for (const order of pending) {
      try {
        await this.refresh(order.id, 'poll')
        checked += 1
      } catch (error) {
        failed += 1
        this.deps.log.warn({ orderId: order.id, reason: describeError(error) }, 'СДЭК: сверка статуса не прошла')
      }
    }

    const stale = await db.order.findMany({
      where: { cdekState: 'creating', cdekRequestedAt: { lt: new Date(this.now() - ADOPT_STALE_MS) } },
      take: limit,
      select: { id: true, number: true },
    })
    for (const order of stale) {
      try {
        await this.resolveStaleCreating(order.id, order.number)
        checked += 1
      } catch (error) {
        failed += 1
        this.deps.log.warn({ orderId: order.id, reason: describeError(error) }, 'СДЭК: зависшая передача не разобрана')
      }
    }
    return { checked, failed }
  }

  async ensureWebhook(): Promise<void> {
    const secret = this.cfg.webhookSecret
    if (!this.cfg.webhookRegistration || secret === null || this.deps.publicUrl === '') return
    const prefix = `${this.deps.publicUrl}${CDEK_WEBHOOK_PATH}`
    const url = `${prefix}${secret}`
    try {
      const hooks = await this.client.listWebhooks()
      if (hooks.some((hook) => hook.url === url)) return
      for (const hook of hooks) {
        if (hook.type === 'ORDER_STATUS' && hook.url.startsWith(prefix)) await this.client.deleteWebhook(hook.uuid)
      }
      await this.client.createWebhook(url)
      this.deps.log.info({}, 'СДЭК: вебхук зарегистрирован')
    } catch (error) {
      this.deps.log.warn({ reason: describeError(error) }, 'СДЭК: вебхук не зарегистрирован, работает сверка')
    }
  }

  async onOrderPaid(orderId: string): Promise<void> {
    if (this.cfg.autoCreate !== 'on_paid') return
    try {
      await this.submit(orderId, 'auto')
    } catch (error) {
      if (error instanceof ApiError && ['CDEK_ALREADY_SUBMITTED', 'CDEK_REJECTED', 'CDEK_NOT_APPLICABLE'].includes(error.code)) return
      this.deps.log.warn({ orderId, reason: describeError(error) }, 'СДЭК: автопередача после оплаты не прошла')
      await this.deps.notifier.onCdekProblem(orderId, 'автопередача после оплаты не прошла, передайте заказ вручную')
    }
  }

  start(): () => void {
    const timer = setInterval(() => {
      this.syncPending().catch((error: unknown) => {
        this.deps.log.warn({ reason: describeError(error) }, 'СДЭК: фоновая сверка не прошла')
      })
    }, SWEEP_INTERVAL_MS)
    timer.unref()
    return () => clearInterval(timer)
  }

  async print(orderId: string, kind: 'waybill' | 'barcode'): Promise<Buffer> {
    const order = await db.order.findUnique({ where: { id: orderId }, select: { cdekUuid: true, cdekNumber: true } })
    if (order === null) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден')
    if (order.cdekUuid === null || order.cdekNumber === null) {
      throw new ApiError(409, 'CDEK_NOT_APPLICABLE', 'Заказ ещё не создан в СДЭК')
    }

    const cacheKey = `${orderId}|${kind}`
    const printUuid = this.printUuids.get(cacheKey) ?? (await this.createPrint(kind, order.cdekUuid, cacheKey))
    for (let attempt = 1; attempt <= PRINT_POLLS; attempt += 1) {
      if (attempt > 1) await this.sleep(PRINT_PAUSE_MS)
      const status = await this.client.getPrint(kind, printUuid)
      if (status.lastStatus === 'INVALID') {
        this.printUuids.set(cacheKey, printUuid, Date.now(), 0)
        throw new ApiError(409, 'PRINT_FAILED', 'СДЭК не сформировал печатную форму')
      }
      if (status.url !== null) return this.client.downloadPdf(status.url)
    }
    throw new ApiError(409, 'WAYBILL_NOT_READY', 'Печатная форма ещё формируется, попробуйте через минуту')
  }

  private async createPrint(kind: 'waybill' | 'barcode', cdekUuid: string, cacheKey: string): Promise<string> {
    const printUuid = await this.client.createPrint(kind, cdekUuid)
    this.printUuids.set(cacheKey, printUuid)
    return printUuid
  }

  private async refusalFor(orderId: string, options: CdekSubmitOptions): Promise<ApiError> {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { status: true, deliveryMethod: true, paymentStatus: true, cdekState: true },
    })
    if (order === null) return new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден')
    if (order.deliveryMethod === 'pickup' || order.status === 'cancelled' || order.status === 'delivered') {
      return new ApiError(409, 'CDEK_NOT_APPLICABLE', 'Передача в СДЭК для этого заказа не нужна')
    }
    const claimable = order.cdekState === null || order.cdekState === 'invalid' || order.cdekState === 'creating'
    if (!options.allowUnpaid && order.paymentStatus !== 'paid' && claimable) {
      return new ApiError(409, 'ORDER_NOT_PAID', 'Сначала отметьте оплату заказа')
    }
    return new ApiError(409, 'CDEK_ALREADY_SUBMITTED', 'Заказ уже передан в СДЭК')
  }

  private async loadForCdek(orderId: string): Promise<OrderForCdek & { number: string }> {
    const row = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        number: true,
        deliveryMethod: true,
        cdekPvzCode: true,
        cdekCityCode: true,
        cdekTariffCode: true,
        deliveryAddress: true,
        recipientName: true,
        recipientPhone: true,
        items: {
          select: {
            productVariantId: true,
            productName: true,
            volumeLabel: true,
            price: true,
            quantity: true,
            productVariant: { select: { weightGrams: true } },
          },
        },
      },
    })
    return {
      ...row,
      items: row.items.map((item) => ({
        productVariantId: item.productVariantId,
        productName: item.productName,
        volumeLabel: item.volumeLabel,
        price: item.price,
        quantity: item.quantity,
        weightGrams: item.productVariant.weightGrams,
      })),
    }
  }

  private async releaseClaim(orderId: string): Promise<void> {
    await db.order.updateMany({
      where: { id: orderId, cdekState: 'creating' },
      data: { cdekState: null, cdekRequestedAt: null },
    })
  }

  private async adopt(orderId: string, info: CdekOrderInfo, source: CdekSource): Promise<void> {
    await db.order.updateMany({
      where: { id: orderId, cdekState: 'creating' },
      data: { cdekState: 'accepted', cdekUuid: info.uuid, cdekError: null },
    })
    await this.applyOrderInfo(orderId, info, source)
  }

  private async pollForNumber(orderId: string, uuid: string): Promise<void> {
    for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
      if (attempt > 1) await this.sleep(POLL_PAUSE_MS)
      try {
        const info = await this.client.getOrder(uuid)
        await this.applyOrderInfo(orderId, info, 'submit')
        if (info.cdekNumber !== null || info.requestState === 'INVALID') return
      } catch (error) {
        this.deps.log.warn({ orderId, reason: describeError(error) }, 'СДЭК: опрос после передачи не удался, подберёт сверка')
        return
      }
    }
  }

  private async resolveStaleCreating(orderId: string, number: string): Promise<void> {
    const prefixed = this.cfg.orderNumberPrefix + number
    const found = await this.client.findOrderByNumber(prefixed)
    if (found !== null && found.number === prefixed) {
      await this.adopt(orderId, found, 'poll')
      return
    }
    const reset = await db.order.updateMany({
      where: {
        id: orderId,
        cdekState: 'creating',
        cdekRequestedAt: { lt: new Date(this.now() - ADOPT_STALE_MS) },
      },
      data: { cdekState: null },
    })
    if (reset.count === 1) {
      await this.deps.notifier.onCdekProblem(orderId, 'передача в СДЭК не подтверждена, нажмите «Передать в СДЭК» снова')
    }
  }

  private async markInvalid(orderId: string, messages: string[], previous: CdekSyncState | null): Promise<void> {
    await db.order.update({
      where: { id: orderId },
      data: {
        cdekState: 'invalid',
        cdekError: (messages.join('; ') || 'СДЭК отклонил заказ').slice(0, ERROR_TEXT_MAX),
      },
    })
    if (previous !== 'invalid') {
      await this.deps.notifier.onCdekProblem(orderId, 'СДЭК отклонил заказ, текст ошибки в админке')
    }
  }

  private async applyLatest(
    orderId: string,
    storedCode: string | null,
    storedAt: Date | null,
    latest: CdekStatus
  ): Promise<void> {
    const newer = storedAt === null || latest.at.getTime() >= storedAt.getTime()
    const changed = storedCode !== latest.code || storedAt?.getTime() !== latest.at.getTime()
    const fresh = newer && changed
    if (fresh) {
      await db.order.update({
        where: { id: orderId },
        data: { cdekStatusCode: latest.code, cdekStatusName: latest.name, cdekStatusAt: latest.at },
      })
    }

    const effect = effectOf(latest.code)
    if (!effect.known) this.deps.log.info({ orderId, code: latest.code }, 'СДЭК: неизвестный код статуса')
    if (effect.orderStatus !== null) await this.moveForward(orderId, effect.orderStatus, latest.at)
    if (effect.problem && fresh) {
      await this.deps.notifier.onCdekProblem(orderId, `код статуса СДЭК: ${latest.code}`)
    }
  }

  private async moveForward(orderId: string, target: ForwardStatus, at: Date): Promise<void> {
    try {
      await db.$transaction(async (tx) => {
        const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } })
        if (current === null || !FORWARD_FROM[target].includes(current.status)) return
        await changeOrderStatus(tx, { orderId, from: current.status, to: target, now: at })
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ORDER_STATUS_CONFLICT') return
      throw error
    }
  }

  private async sendTrackEmail(orderId: string): Promise<void> {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { number: true, cdekNumber: true, recipientEmail: true, user: { select: { email: true } } },
    })
    if (order === null || order.cdekNumber === null) return
    const recipient = order.recipientEmail ?? order.user.email
    if (recipient === null) return

    const claimed = await db.order.updateMany({
      where: { id: orderId, trackEmailSentAt: null, cdekNumber: { not: null } },
      data: { trackEmailSentAt: new Date(this.now()) },
    })
    if (claimed.count !== 1) return
    try {
      await this.deps.mail.sendPlain(
        recipient,
        `Заказ ${order.number} передан в доставку`,
        trackText(order.number, order.cdekNumber, this.deps.publicUrl)
      )
    } catch (error) {
      await db.order.updateMany({ where: { id: orderId }, data: { trackEmailSentAt: null } })
      this.deps.log.warn({ orderId, reason: describeError(error) }, 'СДЭК: письмо с треком не отправлено, повторим')
    }
  }

  private async findByWebhook(body: CdekWebhookBody): Promise<{ id: string } | null> {
    const conditions: Array<{ cdekUuid: string } | { cdekNumber: string }> = []
    if (body.uuid !== undefined) conditions.push({ cdekUuid: body.uuid })
    const cdekNumber = body.attributes?.cdek_number
    if (cdekNumber !== undefined) conditions.push({ cdekNumber: String(cdekNumber) })
    if (conditions.length === 0) return null
    return db.order.findFirst({ where: { OR: conditions }, select: { id: true } })
  }
}

function trackText(number: string, cdekNumber: string, publicUrl: string): string {
  const lines = [
    `Заказ ${number} передан в СДЭК.`,
    `Трек-номер: ${cdekNumber}`,
    `Отследить: https://www.cdek.ru/ru/tracking?order_id=${cdekNumber}`,
  ]
  if (publicUrl !== '') lines.push(`Статус на сайте: ${publicUrl}/track?number=${number}`)
  return lines.join('\n')
}

function describeError(error: unknown): string {
  if (error instanceof CdekUnavailableError) return error.reason
  if (error instanceof CdekRejectedError) return `rejected:${error.httpStatus}`
  if (error instanceof ApiError) return error.code
  return error instanceof Error ? error.name : 'unknown'
}
