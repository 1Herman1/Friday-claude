import { describe, it, expect } from 'vitest'
import { planVariantUpdate } from '../lib/import-prices.plan'

describe('planVariantUpdate', () => {
  const current = {
    wholesalePrice: 500000,
    isProfessional: false,
    retailPrice: 1000000,
    oldRetailPrice: null,
  }

  const item = {
    wholesaleKopecks: 600000,
    retailKopecks: 1200000,
    isProfessional: true,
  }

  it('без флага applyRetail розница не пишется', () => {
    const result = planVariantUpdate(current, item, {})

    expect(result.data).not.toBeNull()
    expect((result.data as any).wholesalePrice).toBe(600000)
    expect((result.data as any).isProfessional).toBe(true)
    expect((result.data as any).retailPrice).toBeUndefined()
    expect((result.data as any).oldRetailPrice).toBeUndefined()
    expect(result.retailChanged).toBe(false)
  })

  it('с флагом applyRetail пишется розница и обнуляется oldRetailPrice', () => {
    const result = planVariantUpdate(current, item, { applyRetail: true })

    expect(result.data).not.toBeNull()
    expect((result.data as any).wholesalePrice).toBe(600000)
    expect((result.data as any).isProfessional).toBe(true)
    expect((result.data as any).retailPrice).toBe(1200000)
    expect((result.data as any).oldRetailPrice).toBeNull()
    expect(result.retailChanged).toBe(true)
  })

  it('если retailKopecks = null, розница не пишется даже с флагом', () => {
    const itemWithoutRetail = { ...item, retailKopecks: null }
    const result = planVariantUpdate(current, itemWithoutRetail, { applyRetail: true })

    expect((result.data as any).retailPrice).toBeUndefined()
    expect(result.retailChanged).toBe(false)
  })

  it('одинаковые значения → data: null', () => {
    const identicalCurrent = {
      wholesalePrice: 600000,
      isProfessional: true,
      retailPrice: 1200000,
      oldRetailPrice: null,
    }

    const result = planVariantUpdate(identicalCurrent, item, { applyRetail: true })

    expect(result.data).toBeNull()
    expect(result.retailChanged).toBe(false)
  })

  it('не обновляет розницу, если она одинаковая', () => {
    const currentWithSameRetail = {
      ...current,
      retailPrice: 1200000, // то же самое, что в item.retailKopecks
    }

    const result = planVariantUpdate(currentWithSameRetail, item, { applyRetail: true })

    expect(result.data).not.toBeNull()
    expect((result.data as any).wholesalePrice).toBe(600000) // отличается
    expect((result.data as any).isProfessional).toBe(true) // отличается
    expect((result.data as any).retailPrice).toBeUndefined() // одинаковая, не пишется
    expect((result.data as any).oldRetailPrice).toBeUndefined()
    expect(result.retailChanged).toBe(false)
  })

  it('обновляет только то, что отличается', () => {
    const partialChange = {
      wholesalePrice: 600000, // одинаково (item.wholesaleKopecks = 600000)
      isProfessional: false, // отличается (item.isProfessional = true)
      retailPrice: 1000000, // одинаково (item.retailKopecks = 1200000, applyRetail=false)
      oldRetailPrice: null,
    }

    const result = planVariantUpdate(partialChange, item, {})

    expect(result.data).not.toBeNull()
    expect((result.data as any).wholesalePrice).toBeUndefined() // одинаково, не меняется
    expect((result.data as any).isProfessional).toBe(true) // отличается, меняется
    expect((result.data as any).retailPrice).toBeUndefined() // без applyRetail не меняется
  })

  it('при applyRetail обновляет и оптовую, и розничную одновременно', () => {
    const changesBoth = {
      wholesalePrice: 550000, // отличается (item.wholesaleKopecks = 600000)
      isProfessional: false, // одинаково
      retailPrice: 1000000, // отличается (item.retailKopecks = 1200000)
      oldRetailPrice: null,
    }

    const result = planVariantUpdate(changesBoth, item, { applyRetail: true })

    expect(result.data).not.toBeNull()
    expect((result.data as any).wholesalePrice).toBe(600000) // оптовая отличается
    expect((result.data as any).retailPrice).toBe(1200000) // розница отличается
    expect((result.data as any).oldRetailPrice).toBeNull()
    expect(result.retailChanged).toBe(true)
  })
})
