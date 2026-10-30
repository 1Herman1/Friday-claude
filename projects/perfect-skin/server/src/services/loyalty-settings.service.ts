import { db, type Prisma, type LoyaltySettings } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'

type Tx = Prisma.TransactionClient

const SINGLETON_ID = 1

export type LoyaltySettingsData = Omit<LoyaltySettings, 'id' | 'createdAt' | 'updatedAt' | 'updatedById'>

type Actor = { id: string; name: string }

export type LoyaltySettingsWithHistory = {
  settings: LoyaltySettings & { updatedBy: Actor | null }
  changes: { id: string; createdAt: Date; changedBy: Actor; before: Prisma.JsonValue; after: Prisma.JsonValue }[]
}

function settingsFields(source: LoyaltySettingsData): LoyaltySettingsData {
  return {
    enabled: source.enabled,
    accrualPercent: source.accrualPercent,
    accrualBase: source.accrualBase,
    accrualTrigger: source.accrualTrigger,
    accrualDelayDays: source.accrualDelayDays,
    excludeProfessionalProducts: source.excludeProfessionalProducts,
    accrueWithPromo: source.accrueWithPromo,
    kopecksPerBonus: source.kopecksPerBonus,
    maxSpendPercent: source.maxSpendPercent,
    minOrderForSpend: source.minOrderForSpend,
    allowSpendWithPromo: source.allowSpendWithPromo,
    bonusTtlDays: source.bonusTtlDays,
    refundMinTtlDays: source.refundMinTtlDays,
    welcomeBonus: source.welcomeBonus,
    welcomeTtlDays: source.welcomeTtlDays,
    reviewBonus: source.reviewBonus,
    reviewTtlDays: source.reviewTtlDays,
    expiryNoticeKind: source.expiryNoticeKind,
    expiryNoticeDaysBefore: source.expiryNoticeDaysBefore,
  }
}

async function readWithHistory(tx: Tx): Promise<LoyaltySettingsWithHistory> {
  const settings = await tx.loyaltySettings.findUniqueOrThrow({
    where: { id: SINGLETON_ID },
    include: { updatedBy: { select: { id: true, name: true } } },
  })
  const changes = await tx.loyaltySettingsChange.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      before: true,
      after: true,
      changedBy: { select: { id: true, name: true } },
    },
  })
  return { settings, changes }
}

export const loyaltySettingsService = {
  get(tx: Tx = db): Promise<LoyaltySettings> {
    return tx.loyaltySettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    })
  },

  getWithHistory(): Promise<LoyaltySettingsWithHistory> {
    return readWithHistory(db)
  },

  update(input: LoyaltySettingsData, expectedUpdatedAt: Date, actorId: string): Promise<LoyaltySettingsWithHistory> {
    return db.$transaction(async (tx) => {
      const before = await tx.loyaltySettings.findUniqueOrThrow({ where: { id: SINGLETON_ID } })

      const result = await tx.loyaltySettings.updateMany({
        where: { id: SINGLETON_ID, updatedAt: expectedUpdatedAt },
        data: { ...settingsFields(input), updatedById: actorId },
      })
      if (result.count === 0) {
        throw new ApiError(409, 'SETTINGS_CONFLICT', 'Настройки изменил другой сотрудник, обновите страницу')
      }

      const after = await tx.loyaltySettings.findUniqueOrThrow({ where: { id: SINGLETON_ID } })
      await tx.loyaltySettingsChange.create({
        data: {
          changedById: actorId,
          before: settingsFields(before),
          after: settingsFields(after),
        },
      })

      return readWithHistory(tx)
    })
  },
}
