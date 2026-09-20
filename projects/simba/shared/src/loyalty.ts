export type BonusLevel = 'newcomer' | 'active' | 'premium'

export interface LoyaltyTier {
  key: BonusLevel
  label: string
  minPoints: number
}

export const LOYALTY_TIERS: LoyaltyTier[] = [
  { key: 'newcomer', label: 'Новичок', minPoints: 0 },
  { key: 'active', label: 'Активный', minPoints: 1000 },
  { key: 'premium', label: 'Премиум', minPoints: 5000 },
]

// Пороги берём из LOYALTY_TIERS, а не повторяем числами: модуль заводился
// ровно затем, чтобы 1000 и 5000 существовали в проекте в одном месте.
export function calculateBonusLevel(points: number): BonusLevel {
  let level: BonusLevel = LOYALTY_TIERS[0].key
  for (const tier of LOYALTY_TIERS) {
    if (points >= tier.minPoints) level = tier.key
  }
  return level
}

/**
 * Информация о текущем уровне и прогрессе к следующему.
 */
export interface LevelProgress {
  currentLevel: LoyaltyTier
  nextLevel: LoyaltyTier | null
  progressPercent: number
}

/**
 * Вычислить текущий уровень, следующий уровень и процент прогресса.
 */
export function getLevelProgress(bonusPoints: number, currentLevel: BonusLevel): LevelProgress {
  const current = LOYALTY_TIERS.find(t => t.key === currentLevel) ?? LOYALTY_TIERS[0]
  const next = LOYALTY_TIERS.find(t => t.minPoints > current.minPoints) ?? null

  const progressPercent = next
    ? Math.min(100, ((bonusPoints - current.minPoints) / (next.minPoints - current.minPoints)) * 100)
    : 100

  return {
    currentLevel: current,
    nextLevel: next,
    progressPercent,
  }
}
