import { z } from 'zod'

/** Единая схема пункта выдачи на входе API: заказы, котировки, заявки. */
export const pickupPointSchema = z.object({
  provider: z.enum(['cdek', 'yandex', 'ozon']),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  workTime: z.string().optional(),
  phone: z.string().optional(),
})
