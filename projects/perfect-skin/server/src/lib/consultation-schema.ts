import { z } from 'zod'

// Нормализует номер телефона: оставляет только цифры
function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

export const consultationSchema = z.object({
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
  email: z.string().email('Неверный email').max(120).optional(),
  channel: z.enum(['phone', 'telegram', 'whatsapp']),
  message: z
    .string()
    .max(1000, 'Сообщение должно быть максимум 1000 символов')
    .optional(),
  skinType: z.enum(['normal', 'dry', 'oily', 'combination', 'sensitive', 'mature', 'all_types']).optional(),
  concern: z
    .string()
    .max(80, 'Задача должна быть максимум 80 символов')
    .optional(),
  source: z.enum(['tile', 'quiz', 'contacts']).optional(),
  consentPd: z.enum(['true'], {
    errorMap: () => ({ message: 'Согласие на обработку ПДн обязательно' }),
  }),
  consentHealth: z.enum(['true'], {
    errorMap: () => ({ message: 'Согласие на обработку данных о состоянии кожи обязательно' }),
  }),
})

export type ConsultationInput = z.infer<typeof consultationSchema>
