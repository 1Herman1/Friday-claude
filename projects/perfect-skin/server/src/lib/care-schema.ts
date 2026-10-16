import { z } from 'zod'
import { normalizePhone } from './consultation-schema.js'

export const careSchema = z.object({
  name: z
    .string()
    .min(2, 'Имя должно быть минимум 2 символа')
    .max(80, 'Имя должно быть максимум 80 символов'),
  phone: z
    .string()
    .min(1, 'Телефон обязателен')
    .transform(normalizePhone)
    .refine(
      (value) => value.length >= 10 && value.length <= 15,
      'Номер должен быть 10–15 цифр'
    ),
  channel: z.enum(['phone', 'telegram', 'whatsapp']),
  consentPd: z.enum(['true'], {
    errorMap: () => ({ message: 'Согласие на обработку ПДн обязательно' }),
  }),
  consentMarketing: z.enum(['true', 'false']).optional(),
})

export type CareInput = z.infer<typeof careSchema>
