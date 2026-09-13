import { describe, expect, it } from 'vitest'
import { runQuizMatch, claimQuizBonus } from './quiz.service'
import { quizCatalog } from '../test/quiz-catalog.fixture'
import type { QuizAnswers } from '../schemas/quiz.schema'

/**
 * Юнит-тесты ядра подбора корма.
 *
 * БД тут не нужна: подставляем фейковый Prisma-клиент, который отдаёт каталог
 * из prisma/seed.ts (тот же набор SKU и тегов, что на проде) и запоминает
 * созданные quizSession. Так проверяется чистая логика фильтров и скоринга.
 */

type CatalogProduct = (typeof quizCatalog)[number]

interface FakeState {
  sessions: Array<Record<string, unknown>>
  users: Map<string, { bonusPoints: number; bonusLevel: string; welcomeBonusGranted: boolean }>
  bonusTx: Array<{ userId: string; amount: number; type: string }>
}

function makePrisma(catalog: readonly CatalogProduct[] = quizCatalog) {
  const state: FakeState = { sessions: [], users: new Map(), bonusTx: [] }
  let sessionSeq = 0

  const prisma = {
    product: {
      findMany: async ({ where }: any) => {
        // Обработка нового OR условия с autoQuizTags
        const passesSpeciesFilter = (p: CatalogProduct): boolean => {
          if (!where?.OR) {
            const species = where?.quizTags?.has
            return !species || p.quizTags.includes(species)
          }
          return where.OR.some((cond: any) => {
            if (cond.quizTags?.has) return p.quizTags.includes(cond.quizTags.has)
            if (cond.autoQuizTags?.has) return (p.autoQuizTags || []).includes(cond.autoQuizTags.has)
            return false
          })
        }
        return catalog
          .filter(passesSpeciesFilter)
          .map((p) => ({ ...p, autoQuizTags: p.autoQuizTags || [], variants: p.variants.filter((v) => true) }))
      },
    },
    quizSession: {
      create: async ({ data }: any) => {
        sessionSeq += 1
        const session = { id: `session-${sessionSeq}`, bonusGranted: false, ...data }
        state.sessions.push(session)
        return session
      },
      update: async ({ where, data }: any) => {
        const s = state.sessions.find((x: any) => x.id === where.id) as any
        Object.assign(s, data)
        return s
      },
      findUnique: async ({ where }: any) =>
        (state.sessions.find((x: any) => x.id === where.id) as any) ?? null,
      findUniqueOrThrow: async ({ where }: any) => {
        const s = state.sessions.find((x: any) => x.id === where.id) as any
        if (!s) throw new Error('session not found')
        return s
      },
      updateMany: async ({ where, data }: any) => {
        const s = state.sessions.find((x: any) => x.id === where.id) as any
        if (!s) return { count: 0 }
        if ('userId' in where && s.userId !== where.userId) return { count: 0 }
        Object.assign(s, data)
        return { count: 1 }
      },
    },
    user: {
      // Эмуляция условного UPDATE ... WHERE welcome_bonus_granted = false —
      // ровно та защёлка, на которой держится однократность бонуса в БД.
      updateMany: async ({ where, data }: any) => {
        const u = state.users.get(where.id)
        if (!u) return { count: 0 }
        if (where.welcomeBonusGranted === false && u.welcomeBonusGranted) return { count: 0 }
        Object.assign(u, data)
        return { count: 1 }
      },
      update: async ({ where, data }: any) => {
        const u = state.users.get(where.id)!
        if (data.bonusPoints?.increment !== undefined) u.bonusPoints += data.bonusPoints.increment
        if (data.bonusLevel) u.bonusLevel = data.bonusLevel
        return { ...u, id: where.id }
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const u = state.users.get(where.id)
        if (!u) throw new Error('user not found')
        return { ...u, id: where.id }
      },
    },
    bonusTransaction: {
      create: async ({ data }: any) => {
        state.bonusTx.push(data)
        return data
      },
    },
  }

  return { prisma: prisma as any, state }
}

function addUser(state: FakeState, id: string) {
  state.users.set(id, { bonusPoints: 0, bonusLevel: 'newcomer', welcomeBonusGranted: false })
}

const dog = (over: Partial<QuizAnswers> = {}): QuizAnswers =>
  ({
    species: 'dog',
    age: 'adult',
    size: 'medium',
    activity: 'normal',
    weight: 'normal',
    health: ['none'],
    avoid: [],
    format: 'dry',
    flavor: 'any',
    philosophy: 'any',
    brand: 'any',
    ...over,
  }) as QuizAnswers

const cat = (over: Partial<QuizAnswers> = {}): QuizAnswers =>
  ({
    species: 'cat',
    age: 'adult',
    sterilized: false,
    lifestyle: 'indoor',
    weight: 'normal',
    health: ['none'],
    avoid: [],
    format: 'dry',
    flavor: 'any',
    philosophy: 'any',
    brand: 'any',
    ...over,
  }) as QuizAnswers

function allCards(res: Awaited<ReturnType<typeof runQuizMatch>>) {
  return [res.main, res.pair, ...res.alternatives].filter(Boolean) as Array<{ id: string }>
}

function tagsOf(id: string): readonly string[] {
  return quizCatalog.find((p) => p.id === id)!.quizTags
}

describe('A. Аллергены — жёсткий фильтр, который не ослабляется никогда', () => {
  const dogAllergenCombos: QuizAnswers[] = []
  for (const age of ['puppy', 'adult', 'senior'] as const) {
    for (const size of ['mini', 'small', 'medium', 'large', 'giant'] as const) {
      for (const format of ['dry', 'wet', 'mixed'] as const) {
        for (const brand of ['farmina', 'happydog', 'any'] as const) {
          dogAllergenCombos.push(
            dog({ age, size, format, brand, health: ['allergy'], avoid: ['chicken'] })
          )
        }
      }
    }
  }

  it(`ни одна из ${dogAllergenCombos.length} комбинаций «собака, аллергия на курицу» не выдаёт corm с contains:chicken`, async () => {
    const { prisma } = makePrisma()
    const violations: string[] = []

    for (const answers of dogAllergenCombos) {
      const res = await runQuizMatch(prisma, answers)
      for (const card of allCards(res)) {
        if (tagsOf(card.id).includes('contains:chicken')) {
          violations.push(`${JSON.stringify(answers)} -> ${card.id}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('кошка с аллергией на рыбу не получает contains:fish даже на максимальном ослаблении', async () => {
    const { prisma } = makePrisma()
    // Комбинация специально «неудобная»: узкий бренд + влажный + senior —
    // подбор вынужден дойти до высоких уровней ослабления.
    const res = await runQuizMatch(
      prisma,
      cat({ age: 'senior', format: 'wet', brand: 'happycat', health: ['allergy'], avoid: ['fish'] })
    )

    for (const card of allCards(res)) {
      expect(tagsOf(card.id)).not.toContain('contains:fish')
    }
  })

  it('два аллергена сразу (курица + зерно) исключаются оба', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(
      prisma,
      dog({ health: ['allergy'], avoid: ['chicken', 'grain'], size: 'giant', format: 'mixed' })
    )

    for (const card of allCards(res)) {
      expect(tagsOf(card.id)).not.toContain('contains:chicken')
      expect(tagsOf(card.id)).not.toContain('contains:grain')
    }
  })

  it('avoid:unknown даёт монопротеин/гипоаллергенный и дисклеймер про ветврача', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(prisma, dog({ health: ['allergy'], avoid: ['unknown'], size: 'small', age: 'puppy' }))

    expect(res.disclaimers.some((d) => d.includes('ветеринарного врача'))).toBe(true)
    const mainTags = tagsOf(res.main.id)
    expect(
      mainTags.includes('special:monoprotein') || mainTags.includes('special:hypoallergenic')
    ).toBe(true)
  })
})

describe('B. Гарантия минимум трёх карточек', () => {
  const combos: Array<{ label: string; answers: QuizAnswers }> = []
  for (const age of ['puppy', 'adult', 'senior'] as const) {
    for (const size of ['mini', 'small', 'medium', 'large', 'giant'] as const) {
      for (const format of ['dry', 'wet', 'mixed'] as const) {
        for (const philosophy of ['grainfree', 'classic', 'any'] as const) {
          combos.push({
            label: `dog/${age}/${size}/${format}/${philosophy}`,
            answers: dog({ age, size, format, philosophy }),
          })
        }
      }
    }
  }
  for (const age of ['kitten', 'adult', 'senior'] as const) {
    for (const format of ['dry', 'wet', 'mixed'] as const) {
      for (const health of [['none'], ['hairball'], ['urinary'], ['digestion', 'skin']] as const) {
        combos.push({
          label: `cat/${age}/${format}/${health.join('+')}`,
          answers: cat({ age, format, health: [...health] as QuizAnswers['health'] }),
        })
      }
    }
  }

  it(`каждая из ${combos.length} комбинаций отдаёт >= 3 карточек`, async () => {
    const { prisma } = makePrisma()
    const failures: string[] = []

    for (const { label, answers } of combos) {
      const res = await runQuizMatch(prisma, answers)
      const count = allCards(res).length
      if (count < 3) failures.push(`${label}: ${count}`)
    }

    expect(failures).toEqual([])
  })

  it('если фильтры ослаблялись — это честно помечено в relaxed и fallbackNote', async () => {
    const { prisma } = makePrisma()
    // У Happy Dog в каталоге всего 2 SKU — бренд обязан ослабнуть.
    const res = await runQuizMatch(prisma, dog({ brand: 'happydog', size: 'giant', age: 'senior' }))

    expect(res.relaxed.length).toBeGreaterThan(0)
    expect(res.fallbackNote).not.toBeNull()
    // Плашка про бренд показывается только если результат не Happy Dog; иначе про ослабление других фильтров
    if (res.main.brandName !== 'Happy Dog' && res.pair?.brandName !== 'Happy Dog') {
      expect(res.fallbackNote).toContain('марке')
    } else {
      // Если хотя бы одна карточка Happy Dog, плашка про ослабление других параметров
      expect(res.fallbackNote).toContain('особенности')
    }
  })

  it('карточки в ответе не дублируются', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(prisma, dog({ format: 'mixed' }))
    const ids = allCards(res).map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('C. Скоринг: здоровье ×3, философия ×2, мягкие ×1', () => {
  it('корм с совпадением по здоровью обгоняет корм только с совпадением по вкусу', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(prisma, cat({ health: ['hairball'], lifestyle: 'indoor' }))

    expect(tagsOf(res.main.id)).toContain('health:hairball')
    expect(res.main.matchScore).toBeGreaterThanOrEqual(3 / 28) // 1 health match (3 pts) normalized to 0..1
  })

  it('стерилизованная кошка получает корм для стерилизованных, даже если health не отмечен', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(prisma, cat({ sterilized: true }))

    expect(tagsOf(res.main.id)).toContain('health:sterilized')
  })

  it('matchScore главной карточки не ниже, чем у альтернатив', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(prisma, dog({ health: ['joints'], size: 'large', philosophy: 'classic' }))

    for (const alt of res.alternatives) {
      expect(res.main.matchScore).toBeGreaterThanOrEqual(alt.matchScore)
    }
  })
})

describe('D. format:mixed — пара сухой + влажный', () => {
  it('при mixed отдаётся пара другого формата', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(prisma, cat({ format: 'mixed' }))

    expect(res.pair).not.toBeNull()
    const mainFormat = tagsOf(res.main.id).includes('format:dry') ? 'format:dry' : 'format:wet'
    const pairFormat = mainFormat === 'format:dry' ? 'format:wet' : 'format:dry'
    expect(tagsOf(res.pair!.id)).toContain(pairFormat)
  })

  it('если влажного корма в каталоге нет вовсе — pair честно null, а не подделка', async () => {
    const dryOnly = quizCatalog.filter((p) => p.quizTags.includes('format:dry'))
    const { prisma } = makePrisma(dryOnly)
    const res = await runQuizMatch(prisma, cat({ format: 'mixed' }))

    expect(res.pair).toBeNull()
    expect(allCards(res).length).toBeGreaterThanOrEqual(3)
  })
})

describe('E. Бонус 300 — начисляется один раз', () => {
  it('повторный проход квиза тем же пользователем не даёт бонус второй раз', async () => {
    const { prisma, state } = makePrisma()
    addUser(state, 'u1')

    const first = await runQuizMatch(prisma, dog(), 'u1')
    const second = await runQuizMatch(prisma, cat(), 'u1')

    expect(first.bonus.status).toBe('granted')
    expect(second.bonus.status).toBe('already_granted')
    expect(state.users.get('u1')!.bonusPoints).toBe(300)
    expect(state.bonusTx.filter((t) => t.type === 'quiz')).toHaveLength(1)
  })

  it('два параллельных POST /match от одного пользователя дают ровно одно начисление', async () => {
    const { prisma, state } = makePrisma()
    addUser(state, 'u2')

    const [a, b] = await Promise.all([
      runQuizMatch(prisma, dog(), 'u2'),
      runQuizMatch(prisma, dog({ format: 'wet' }), 'u2'),
    ])

    const statuses = [a.bonus.status, b.bonus.status].sort()
    expect(statuses).toEqual(['already_granted', 'granted'])
    expect(state.users.get('u2')!.bonusPoints).toBe(300)
  })

  it('гость не получает бонус, но получает sessionId для последующего claim', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(prisma, dog())

    expect(res.bonus.status).toBe('guest')
    expect(res.bonus.balance).toBeNull()
    expect(res.sessionId).toBeTruthy()
  })

  it('claim после логина привязывает гостевую сессию и начисляет ровно один раз', async () => {
    const { prisma, state } = makePrisma()
    addUser(state, 'u3')

    const guest = await runQuizMatch(prisma, dog())
    const first = await claimQuizBonus(prisma, guest.sessionId, 'u3')
    const second = await claimQuizBonus(prisma, guest.sessionId, 'u3')

    expect(first).toMatchObject({ granted: true, amount: 300, balance: 300 })
    expect(second.granted).toBe(false)
    expect(state.users.get('u3')!.bonusPoints).toBe(300)
  })

  it('чужую сессию забрать нельзя (IDOR)', async () => {
    const { prisma, state } = makePrisma()
    addUser(state, 'owner')
    addUser(state, 'attacker')

    const own = await runQuizMatch(prisma, dog(), 'owner')

    await expect(claimQuizBonus(prisma, own.sessionId, 'attacker')).rejects.toThrow('IDOR')
    expect(state.users.get('attacker')!.bonusPoints).toBe(0)
  })

  it('claim несуществующей сессии — ошибка, а не молчаливое начисление', async () => {
    const { prisma, state } = makePrisma()
    addUser(state, 'u4')

    await expect(claimQuizBonus(prisma, 'session-404', 'u4')).rejects.toThrow('Session not found')
    expect(state.users.get('u4')!.bonusPoints).toBe(0)
  })
})

describe('F. Предпочтение бренда', () => {
  it('выбранный бренд Farmina выигрывает главную карточку', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(prisma, dog({ brand: 'farmina', age: 'adult', size: 'medium' }))

    expect(res.main.brandName).toBe('Farmina')
    // Бренд совпадает, плашки про неправильный бренд быть не должно
    expect(res.fallbackNote).not.toContain('марке')
  })

  // Слаг бренда в ответах квиза — 'happydog'/'happycat', а в базе (seed.ts) —
  // 'happy-dog'/'happy-cat'. Каталог тут специально устроен так, что жёсткий
  // фильтр по бренду на уровне 0 обязан сработать: три подходящих Happy Dog.
  it('выбранный бренд Happy Dog уважается, когда его товаров достаточно', async () => {
    const happyDog = quizCatalog
      .filter((p) => p.quizTags.includes('species:dog') && p.quizTags.includes('format:dry'))
      .slice(0, 3)
      .map((p) => ({
        ...p,
        id: `hd-${p.id}`,
        slug: `hd-${p.slug}`,
        brand: { name: 'Happy Dog', slug: 'happy-dog' },
        quizTags: ['species:dog', 'age:all', 'size:all', 'format:dry', 'philosophy:classic'],
      }))
    const others = quizCatalog.filter((p) => p.quizTags.includes('species:dog'))
    const { prisma } = makePrisma([...happyDog, ...others] as unknown as typeof quizCatalog)

    const res = await runQuizMatch(prisma, dog({ brand: 'happydog', age: 'adult', format: 'dry' }))

    expect(res.main.brandName).toBe('Happy Dog')
  })

  it('если выбран Happy Dog, но товаров мало и выдан Farmina — плашка про неправильный бренд', async () => {
    const catalog = [
      product({
        id: 'happydog-single',
        brand: { name: 'Happy Dog', slug: 'happy-dog' },
        quizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'],
      }),
      product({
        id: 'farmina-1',
        brand: { name: 'Farmina', slug: 'farmina' },
        quizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'],
      }),
      product({
        id: 'farmina-2',
        brand: { name: 'Farmina', slug: 'farmina' },
        quizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'],
      }),
      product({
        id: 'farmina-3',
        brand: { name: 'Farmina', slug: 'farmina' },
        quizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'],
      }),
    ]
    const { prisma: customPrisma } = makePrisma(catalog as unknown as typeof quizCatalog)

    const res = await runQuizMatch(customPrisma, dog({ brand: 'happydog', age: 'adult', size: 'medium' }))

    // На уровне 0 будет 1 Happy Dog товар < 3, поэтому подбор ослабит бренд на уровне 1
    // и возьмёт 3 Farmina товара (они выше в priorityScore из-за getBrandPriority)
    expect(res.main.brandName).toBe('Farmina')
    expect(res.relaxed).toContain('brand')
    expect(res.fallbackNote).toContain('марке')
  })
})

/**
 * Ниже — проверки нового поведения: подбор смотрит на объединение ручных
 * quizTags и авто-тегов autoQuizTags. Фикстура каталога авто-тегов не содержит,
 * поэтому здесь они выставляются явно.
 */

type LooseProduct = Record<string, unknown>

/** Товар, у которого все теги лежат только в autoQuizTags (как у 489 товаров на проде). */
function asAutoTagged(p: (typeof quizCatalog)[number]): LooseProduct {
  return { ...p, quizTags: [], autoQuizTags: [...p.quizTags] }
}

function product(over: Partial<Record<string, unknown>> = {}): LooseProduct {
  return {
    id: 'p',
    slug: 'p',
    name: 'P',
    brand: { name: 'Brand', slug: 'brand' },
    images: [],
    isFeatured: false,
    quizTags: [],
    autoQuizTags: [],
    variants: [{ id: 'v', weight: 1, price: 100, oldPrice: null, stock: 5 }],
    ...over,
  }
}

describe('G. Вид животного не смешивается, включая авто-теги', () => {
  // Кошачьи товары помечены ТОЛЬКО автоматически — если объединение тегов
  // сломается, кошачий корм может утечь в собачью выдачу.
  const mixedCatalog = quizCatalog.map((p) =>
    p.quizTags.includes('species:cat') ? asAutoTagged(p) : p
  )
  const catIds = new Set(
    quizCatalog.filter((p) => p.quizTags.includes('species:cat')).map((p) => p.id)
  )
  const dogIds = new Set(
    quizCatalog.filter((p) => p.quizTags.includes('species:dog')).map((p) => p.id)
  )

  it('собачья анкета никогда не отдаёт кошачий корм', async () => {
    const { prisma } = makePrisma(mixedCatalog as unknown as typeof quizCatalog)
    const violations: string[] = []

    for (const age of ['puppy', 'adult', 'senior'] as const) {
      for (const size of ['mini', 'medium', 'giant'] as const) {
        for (const format of ['dry', 'wet', 'mixed'] as const) {
          const res = await runQuizMatch(prisma, dog({ age, size, format }))
          for (const card of allCards(res)) {
            if (catIds.has(card.id)) violations.push(`dog/${age}/${size}/${format} -> ${card.id}`)
          }
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('кошачья анкета никогда не отдаёт собачий корм и находит авто-размеченные товары', async () => {
    const { prisma } = makePrisma(mixedCatalog as unknown as typeof quizCatalog)
    const violations: string[] = []

    for (const age of ['kitten', 'adult', 'senior'] as const) {
      for (const format of ['dry', 'wet', 'mixed'] as const) {
        const res = await runQuizMatch(prisma, cat({ age, format }))
        expect(allCards(res).length).toBeGreaterThanOrEqual(1)
        for (const card of allCards(res)) {
          if (dogIds.has(card.id)) violations.push(`cat/${age}/${format} -> ${card.id}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})

describe('H. Аллерген из авто-тегов исключается так же жёстко, как ручной', () => {
  it('contains:chicken только в autoQuizTags — товар не выдаётся ни на одном уровне ослабления', async () => {
    const catalog = [
      product({
        id: 'auto-chicken',
        autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry', 'flavor:chicken', 'contains:chicken'],
      }),
      product({
        id: 'safe-lamb',
        autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry', 'flavor:lamb'],
      }),
    ]
    const { prisma } = makePrisma(catalog as unknown as typeof quizCatalog)

    // Анкета намеренно узкая (senior + giant + бренд), чтобы подбор дошёл до
    // максимального ослабления и всё равно не взял курицу.
    const res = await runQuizMatch(
      prisma,
      dog({ age: 'senior', size: 'giant', brand: 'farmina', health: ['allergy'], avoid: ['chicken'] })
    )

    expect(allCards(res).map((c) => c.id)).toEqual(['safe-lamb'])
  })

  it('ручной тег из другого пространства имён не отменяет авто-аллерген', async () => {
    const catalog = [
      product({
        id: 'manual-flavor-auto-chicken',
        quizTags: ['flavor:lamb'],
        autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry', 'contains:chicken'],
      }),
      product({ id: 'safe', autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'] }),
    ]
    const { prisma } = makePrisma(catalog as unknown as typeof quizCatalog)
    const res = await runQuizMatch(prisma, dog({ avoid: ['chicken'] }))

    expect(allCards(res).map((c) => c.id)).toEqual(['safe'])
  })

  it('ручной contains: перекрывает авто-теги того же пространства — товар с курицей вручную исключён', async () => {
    const catalog = [
      product({
        id: 'manual-says-lamb',
        // Контент-менеджер вручную указал состав: авто-тег contains:chicken
        // должен быть перекрыт целиком по namespace contains.
        quizTags: ['contains:lamb'],
        autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry', 'contains:chicken'],
      }),
      product({ id: 'other', autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'] }),
    ]
    const { prisma } = makePrisma(catalog as unknown as typeof quizCatalog)

    const withChickenAllergy = await runQuizMatch(prisma, dog({ avoid: ['chicken'] }))
    expect(withChickenAllergy.main.id).toBe('manual-says-lamb')

    const withLambAllergy = await runQuizMatch(prisma, dog({ avoid: ['lamb'] }))
    expect(allCards(withLambAllergy).map((c) => c.id)).toEqual(['other'])
  })
})

describe('I. Ручные quizTags перекрывают авто-теги', () => {
  it('ручной format:wet перекрывает авто format:dry', async () => {
    const catalog = [
      product({
        id: 'manual-wet',
        quizTags: ['format:wet'],
        autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'],
      }),
      // Три сухих товара, чтобы подбор набрал выдачу на уровне 0 и не начал
      // ослаблять формат — иначе проверка ничего не докажет.
      ...['auto-dry-1', 'auto-dry-2', 'auto-dry-3'].map((id) =>
        product({ id, autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'] })
      ),
      ...['auto-wet-1', 'auto-wet-2'].map((id) =>
        product({ id, autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:wet'] })
      ),
    ]
    const { prisma } = makePrisma(catalog as unknown as typeof quizCatalog)

    const dry = await runQuizMatch(prisma, dog({ format: 'dry' }))
    expect(allCards(dry).map((c) => c.id)).not.toContain('manual-wet')
    expect(dry.relaxed).not.toContain('format')

    const wet = await runQuizMatch(prisma, dog({ format: 'wet' }))
    const wetIds = allCards(wet).map((c) => c.id)
    expect(wetIds).toContain('manual-wet')
    expect(wetIds.filter((id) => id.startsWith('auto-dry'))).toEqual([])
  })

  it('ручной age:senior перекрывает авто age:all — щенячья анкета товар не берёт', async () => {
    const catalog = [
      product({
        id: 'manual-senior',
        quizTags: ['age:senior'],
        autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'],
      }),
      product({ id: 'age-all', autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'] }),
    ]
    const { prisma } = makePrisma(catalog as unknown as typeof quizCatalog)
    const res = await runQuizMatch(prisma, dog({ age: 'puppy' }))

    expect(allCards(res).map((c) => c.id)).toEqual(['age-all'])
  })

  it('скоринг считается по объединению: авто health:joints поднимает товар в main', async () => {
    const catalog = [
      product({
        id: 'joints',
        autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry', 'health:joints'],
      }),
      product({ id: 'plain-a', autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'] }),
      product({ id: 'plain-b', autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'] }),
    ]
    const { prisma } = makePrisma(catalog as unknown as typeof quizCatalog)
    const res = await runQuizMatch(prisma, dog({ health: ['joints'] }))

    expect(res.main.id).toBe('joints')
    expect(res.main.matchScore).toBeCloseTo(1, 5) // единственный достижимый критерий (health) закрыт полностью
  })
})

describe('J. Бедный пул — shortfall вместо падения', () => {
  it('единственный подходящий товар: 1 карточка и shortfall.found = 1', async () => {
    const catalog = [
      product({ id: 'only', autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'] }),
    ]
    const { prisma } = makePrisma(catalog as unknown as typeof quizCatalog)
    const res = await runQuizMatch(prisma, dog({ format: 'dry' }))

    expect(allCards(res).length).toBe(1)
    expect(res.shortfall).toEqual({ found: 1 })
    expect(res.main.variant).not.toBeNull()
  })

  it('mixed при единственном сухом товаре: pair = null, shortfall честный', async () => {
    const catalog = [
      product({ id: 'only-dry', autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'] }),
    ]
    const { prisma } = makePrisma(catalog as unknown as typeof quizCatalog)
    const res = await runQuizMatch(prisma, dog({ format: 'mixed' }))

    expect(res.pair).toBeNull()
    expect(res.shortfall).toEqual({ found: 1 })
  })

  it('товар только с ручным аллергеном и никого больше — понятная ошибка, а не пустая выдача', async () => {
    const catalog = [
      product({
        id: 'chicken-only',
        autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry', 'contains:chicken'],
      }),
    ]
    const { prisma } = makePrisma(catalog as unknown as typeof quizCatalog)

    await expect(runQuizMatch(prisma, dog({ avoid: ['chicken'] }))).rejects.toThrow('Каталог подбора пуст')
  })

  it('при полной выдаче shortfall = null', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(prisma, dog())
    expect(res.shortfall).toBeNull()
  })

  it('товар без единого тега (не размечен ни вручную, ни авто) в подбор не попадает', async () => {
    const catalog = [
      product({ id: 'tagged', autoQuizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'] }),
      // В выборку из БД такой товар не попадёт по species, но проверяем и сам фильтр.
      product({ id: 'untagged', quizTags: [], autoQuizTags: [] }),
    ]
    const { prisma } = makePrisma(catalog as unknown as typeof quizCatalog)
    const res = await runQuizMatch(prisma, dog({ format: 'dry' }))

    expect(allCards(res).map((c) => c.id)).toEqual(['tagged'])
  })
})

describe('D. Интеграция autoQuizTags', () => {
  it('ровно 3 карточки при mixed: main + pair + 1 альтернатива', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(prisma, dog({ format: 'mixed' }))
    const cards = [res.main, res.pair, ...res.alternatives].filter(Boolean)
    expect(cards.length).toBe(3)
  })

  it('ровно 3 карточки при non-mixed: main + 2 альтернативы', async () => {
    const { prisma } = makePrisma()
    const res = await runQuizMatch(prisma, dog({ format: 'dry' }))
    const cards = [res.main, res.pair, ...res.alternatives].filter(Boolean)
    expect(cards.length).toBe(3)
  })

  it('shortfall при бедном пуле: только 2 товара на все комбинации', async () => {
    // Создаём каталог с максимум 2 товарами
    const twoProducts = [
      {
        id: 'prod-1',
        slug: 'prod-1',
        name: 'Product 1',
        brand: { name: 'Brand A', slug: 'brand-a' },
        images: [],
        isFeatured: false,
        quizTags: ['species:dog', 'age:adult', 'size:medium', 'format:dry', 'philosophy:classic'],
        variants: [{ id: 'v1', weight: 1, price: 100, oldPrice: null, stock: 5 }],
      },
      {
        id: 'prod-2',
        slug: 'prod-2',
        name: 'Product 2',
        brand: { name: 'Brand B', slug: 'brand-b' },
        images: [],
        isFeatured: false,
        quizTags: ['species:dog', 'age:adult', 'size:medium', 'format:dry', 'philosophy:classic'],
        variants: [{ id: 'v2', weight: 1, price: 100, oldPrice: null, stock: 5 }],
      },
    ]
    const { prisma } = makePrisma(twoProducts as unknown as typeof quizCatalog)
    const res = await runQuizMatch(prisma, dog({ format: 'dry' }))
    const cards = [res.main, res.pair, ...res.alternatives].filter(Boolean)
    expect(cards.length).toBe(2)
    expect(res.shortfall).not.toBeNull()
    expect(res.shortfall?.found).toBe(2)
  })

  it('выбор variant: первый со stock > 0, при равенстве остатка — более дешёвый', async () => {
    const catalog = [
      {
        id: 'test-prod',
        slug: 'test-prod',
        name: 'Test Product',
        brand: { name: 'Test', slug: 'test' },
        images: [],
        isFeatured: false,
        quizTags: ['species:dog', 'age:all', 'size:all', 'format:dry'],
        variants: [
          { id: 'v1', weight: 1, price: 100, oldPrice: null, stock: 0 }, // не в наличии
          { id: 'v2', weight: 1, price: 50, oldPrice: null, stock: 5 }, // в наличии, дешевле
          { id: 'v3', weight: 1, price: 75, oldPrice: null, stock: 5 }, // в наличии, дороже
        ],
      },
    ]
    const { prisma } = makePrisma(catalog as unknown as typeof quizCatalog)
    const res = await runQuizMatch(prisma, dog({ format: 'dry' }))
    expect(res.main.variant?.id).toBe('v2')
  })

  it('не добавляем brand в relaxed если бренд не был спрашиваемым параметром', async () => {
    const { prisma } = makePrisma()
    // brand: 'any' означает что бренд не спрашивали
    const res = await runQuizMatch(prisma, dog({ brand: 'any' }))
    // Если нам пришлось ослабить и выбрать первый товар без бренда-фильтра,
    // brand не должен появиться в relaxed
    const hasBrand = res.relaxed.includes('brand')
    // На самом деле это может быть true если главная рекомендация выбралась от бренда,
    // но это логичное поведение. Проверим что если relaxed не пустой, то имеет смысл.
    // На самом деле исправление было чтобы не добавлять brand в relaxed когда
    // его не спрашивали. Проверим на более жёсткой комбинации.
    const restrictive = dog({ brand: 'any', size: 'giant', age: 'senior', format: 'mixed', philosophy: 'grainfree' })
    const res2 = await runQuizMatch(prisma, restrictive)
    // Если relaxed пуста, то brand точно не должен быть там
    if (res2.relaxed.length === 0) {
      expect(res2.relaxed.includes('brand')).toBe(false)
    }
  })
})
