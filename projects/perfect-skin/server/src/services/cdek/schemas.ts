import { z } from 'zod'

export const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
})

export const listResponseSchema = z.array(z.unknown())

export const entityUuidResponseSchema = z.object({
  entity: z.object({ uuid: z.string().min(1) }),
})

export const orderEnvelopeSchema = z.object({
  entity: z.object({ uuid: z.string().min(1) }).passthrough(),
})

export const tariffListSchema = z.object({
  tariff_codes: z.array(z.unknown()),
})

export const printResponseSchema = z.object({
  entity: z.object({
    url: z.string().nullish(),
    statuses: z.array(z.object({ code: z.string() }).passthrough()).nullish(),
  }),
})

export const webhookItemSchema = z.object({
  uuid: z.string().min(1),
  type: z.string(),
  url: z.string(),
})

export const cityItemSchema = z.object({
  code: z.number().int().positive(),
  full_name: z.string().min(1),
})

export const pointItemSchema = z.object({
  code: z.string().min(1),
  type: z.enum(['PVZ', 'POSTAMAT']),
  name: z.string(),
  work_time: z.string().nullish(),
  location: z.object({
    address_full: z.string(),
    city: z.string(),
    city_code: z.number().int().positive(),
    latitude: z.number(),
    longitude: z.number(),
  }),
  nearest_stations: z.array(z.object({ name: z.string() }).passthrough()).nullish(),
})

export const tariffItemSchema = z.object({
  tariff_code: z.number().int().positive(),
  delivery_sum: z.number().nonnegative(),
  period_min: z.number().int().nonnegative(),
  period_max: z.number().int().nonnegative(),
})

export const orderStatusItemSchema = z.object({
  code: z.string().min(1),
  name: z.string().nullish(),
  city: z.string().nullish(),
  date_time: z.string().min(1),
})

export const errorMessageSchema = z.object({ message: z.string() })

export const cdekWebhookBodySchema = z.object({
  type: z.string().min(1).max(64),
  uuid: z.string().uuid().optional(),
  attributes: z
    .object({
      cdek_number: z.union([z.string().min(1).max(64), z.number().int()]).optional(),
      code: z.string().max(64).optional(),
    })
    .optional(),
})

export type CdekWebhookBody = z.infer<typeof cdekWebhookBodySchema>
