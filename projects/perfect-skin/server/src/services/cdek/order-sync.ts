import { z } from 'zod'
import type { CdekConfig } from './config.js'
import type { CdekCreateOrderPayload } from './client.js'
import { ApiError } from '../../lib/errors.js'

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
