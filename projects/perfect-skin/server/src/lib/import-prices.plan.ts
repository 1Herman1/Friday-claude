// Планирование обновлений вариантов товаров при импорте цен
// Чистая функция без БД — для тестирования логики

interface CurrentVariant {
  wholesalePrice: number | null
  isProfessional: boolean
  retailPrice: number
  oldRetailPrice?: number | null
}

interface PriceImportItem {
  wholesaleKopecks: number
  retailKopecks: number | null
  isProfessional: boolean
}

interface PlanOptions {
  applyRetail?: boolean
}

interface UpdatePlan {
  data: {
    wholesalePrice?: number
    isProfessional?: boolean
    retailPrice?: number
    oldRetailPrice?: null
  } | null
  retailChanged: boolean
}

/**
 * Планирует обновление вариантов: сравнивает текущие значения с целевыми,
 * возвращает данные для записи (или null, если изменений нет)
 *
 * Логика:
 * - wholesalePrice и isProfessional всегда обновляются, если отличаются
 * - retailPrice обновляется только если applyRetail=true и retailKopecks задан
 * - oldRetailPrice обнуляется только при обновлении retailPrice
 * - Если ничего не изменилось → data: null
 */
export function planVariantUpdate(
  current: CurrentVariant,
  item: PriceImportItem,
  options: PlanOptions = {},
): UpdatePlan {
  const data: UpdatePlan['data'] = {}
  let retailChanged = false

  // Оптовая цена
  if (current.wholesalePrice !== item.wholesaleKopecks) {
    ;(data as any).wholesalePrice = item.wholesaleKopecks
  }

  // Профессиональный флаг
  if (current.isProfessional !== item.isProfessional) {
    ;(data as any).isProfessional = item.isProfessional
  }

  // Розничная цена (только при applyRetail)
  if (options.applyRetail && item.retailKopecks !== null) {
    if (current.retailPrice !== item.retailKopecks) {
      ;(data as any).retailPrice = item.retailKopecks
      ;(data as any).oldRetailPrice = null
      retailChanged = true
    }
  }

  // Если ничего не изменилось
  const hasChanges = Object.keys(data).length > 0
  if (!hasChanges) {
    return { data: null, retailChanged: false }
  }

  return {
    data: (Object.keys(data).length > 0 ? data : null) as any,
    retailChanged,
  }
}
