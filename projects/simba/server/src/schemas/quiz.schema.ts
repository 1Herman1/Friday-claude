import { z } from 'zod'

const dogAnswersSchema = z.object({
  species: z.literal('dog'),
  age: z.enum(['puppy', 'adult', 'senior']),
  size: z.enum(['mini', 'small', 'medium', 'large', 'giant']),
  activity: z.enum(['low', 'normal', 'high']),
  weight: z.enum(['normal', 'overweight', 'underweight']),
  health: z.array(z.enum(['digestion', 'skin', 'allergy', 'sterilized', 'joints', 'none'])).min(1).max(6),
  avoid: z.array(z.enum(['chicken', 'beef', 'grain', 'unknown'])).max(4).default([]),
  format: z.enum(['dry', 'wet', 'mixed']),
  flavor: z.enum(['chicken', 'lamb', 'fish', 'game', 'any']),
  philosophy: z.enum(['grainfree', 'lowgrain', 'classic', 'any']),
  brand: z.enum(['farmina', 'monge', 'hills', 'happydog', 'any']),
})

const catAnswersSchema = z.object({
  species: z.literal('cat'),
  age: z.enum(['kitten', 'adult', 'senior']),
  sterilized: z.boolean(),
  lifestyle: z.enum(['indoor', 'outdoor']),
  weight: z.enum(['normal', 'overweight', 'underweight']),
  health: z.array(z.enum(['digestion', 'hairball', 'skin', 'allergy', 'urinary', 'longhair', 'none'])).min(1).max(7),
  avoid: z.array(z.enum(['chicken', 'fish', 'grain', 'unknown'])).max(4).default([]),
  format: z.enum(['dry', 'wet', 'mixed']),
  flavor: z.enum(['chicken', 'fish', 'game', 'picky', 'any']),
  philosophy: z.enum(['grainfree', 'lowgrain', 'classic', 'any']),
  brand: z.enum(['farmina', 'monge', 'hills', 'happycat', 'any']),
})

export const quizAnswersSchema = z
  .discriminatedUnion('species', [dogAnswersSchema, catAnswersSchema])
  .superRefine((a, ctx) => {
    if (a.health.includes('allergy') && a.avoid.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['avoid'], message: 'Укажите, на какой белок реагирует питомец' })
    }
    if (a.health.includes('none') && a.health.length > 1) {
      ctx.addIssue({ code: 'custom', path: ['health'], message: 'Вариант «Ничего из перечисленного» нельзя сочетать с другими' })
    }
  })

export type QuizAnswers = z.infer<typeof quizAnswersSchema>
export const claimSchema = z.object({ sessionId: z.string().uuid() })
