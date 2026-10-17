import { describe, it, expect } from 'vitest'
import {
  planConsultationRetention,
  type RetentionPlan,
  type RetentionRow,
} from '../lib/consultation-retention.js'

const NOW = new Date('2026-10-17T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS)
}

function row(overrides: Partial<RetentionRow> & { id: string }): RetentionRow {
  return {
    status: 'new',
    updatedAt: daysAgo(1),
    anonymizedAt: null,
    ...overrides,
  }
}

// Автозакрытие: открытые заявки, которые закроются в этом прогоне
const autoClosed = (plan: RetentionPlan) => [...plan.closeAndErase, ...plan.closeOnly].sort()
// Стирание: все заявки, чьи персональные данные уйдут в этом прогоне
const erased = (plan: RetentionPlan) => [...plan.closeAndErase, ...plan.erase].sort()

describe('planConsultationRetention: срок 90 дней', () => {
  it('89 дней без движения — ещё не трогаем', () => {
    const plan = planConsultationRetention([row({ id: 'a', status: 'new', updatedAt: daysAgo(89) })], NOW)
    expect(autoClosed(plan)).toEqual([])
    expect(erased(plan)).toEqual([])
  })

  it('ровно 90 дней — граница строгая, тоже не трогаем', () => {
    const plan = planConsultationRetention([row({ id: 'a', status: 'new', updatedAt: daysAgo(90) })], NOW)
    expect(autoClosed(plan)).toEqual([])
    expect(erased(plan)).toEqual([])
  })

  it('91 день без движения — закрываем и стираем', () => {
    const plan = planConsultationRetention([row({ id: 'a', status: 'new', updatedAt: daysAgo(91) })], NOW)
    expect(autoClosed(plan)).toEqual(['a'])
    expect(erased(plan)).toEqual(['a'])
  })
})

describe('planConsultationRetention: статусы', () => {
  it.each(['new', 'contacted', 'scheduled'] as const)('открытый статус %s закрывается автоматически', (status) => {
    const plan = planConsultationRetention([row({ id: 'a', status, updatedAt: daysAgo(100) })], NOW)
    expect(autoClosed(plan)).toEqual(['a'])
  })

  it.each(['done', 'cancelled'] as const)('закрытый статус %s не закрываем повторно, но стираем', (status) => {
    const plan = planConsultationRetention([row({ id: 'a', status, updatedAt: daysAgo(100) })], NOW)
    expect(autoClosed(plan)).toEqual([])
    expect(erased(plan)).toEqual(['a'])
  })
})

describe('planConsultationRetention: уже стёртые пропускаются', () => {
  it('стёртая закрытая заявка не попадает ни в один шаг', () => {
    const plan = planConsultationRetention(
      [row({ id: 'a', status: 'done', updatedAt: daysAgo(400), anonymizedAt: daysAgo(100) })],
      NOW,
    )
    expect(autoClosed(plan)).toEqual([])
    expect(erased(plan)).toEqual([])
  })

  it('стёртая открытая заявка закрывается, но второй раз не стирается', () => {
    const plan = planConsultationRetention(
      [row({ id: 'a', status: 'contacted', updatedAt: daysAgo(400), anonymizedAt: daysAgo(100) })],
      NOW,
    )
    expect(plan.closeOnly).toEqual(['a'])
    expect(erased(plan)).toEqual([])
  })
})

describe('planConsultationRetention: оба шага в одном прогоне', () => {
  it('открытая старая заявка попадает и в автозакрытие, и в стирание из одного снимка', () => {
    const plan = planConsultationRetention([row({ id: 'a', status: 'scheduled', updatedAt: daysAgo(120) })], NOW)
    expect(plan.closeAndErase).toEqual(['a'])
  })

  it('свободная заявка без движения и свежая заявка разводятся по шагам правильно', () => {
    const plan = planConsultationRetention(
      [
        row({ id: 'old-open', status: 'new', updatedAt: daysAgo(200) }),
        row({ id: 'old-done', status: 'done', updatedAt: daysAgo(200) }),
        row({ id: 'fresh-open', status: 'new', updatedAt: daysAgo(10) }),
      ],
      NOW,
    )
    expect(autoClosed(plan)).toEqual(['old-open'])
    expect(erased(plan)).toEqual(['old-done', 'old-open'])
  })
})

describe('planConsultationRetention: повторный прогон', () => {
  it('после применения плана второй прогон ничего не находит', () => {
    const rows: RetentionRow[] = [
      row({ id: 'open-old', status: 'new', updatedAt: daysAgo(120) }),
      row({ id: 'closed-old', status: 'cancelled', updatedAt: daysAgo(300) }),
      row({ id: 'fresh', status: 'contacted', updatedAt: daysAgo(5) }),
    ]

    const first = planConsultationRetention(rows, NOW)
    const applied = applyPlan(rows, first, NOW)
    const second = planConsultationRetention(applied, NOW)

    expect(autoClosed(first)).toEqual(['open-old'])
    expect(erased(first)).toEqual(['closed-old', 'open-old'])
    expect(second).toEqual({ closeAndErase: [], closeOnly: [], erase: [] })
  })
})

// Повторяет запись прогона: автозакрытие и стирание двигают updatedAt, как Prisma @updatedAt
function applyPlan(rows: RetentionRow[], plan: RetentionPlan, now: Date): RetentionRow[] {
  const closed = new Set(autoClosed(plan))
  const erasedSet = new Set(erased(plan))

  return rows.map((r): RetentionRow => {
    const isClosed = closed.has(r.id)
    const isErased = erasedSet.has(r.id)
    return {
      ...r,
      status: isClosed ? 'cancelled' : r.status,
      updatedAt: isClosed || isErased ? now : r.updatedAt,
      anonymizedAt: isErased ? now : r.anonymizedAt,
    }
  })
}
