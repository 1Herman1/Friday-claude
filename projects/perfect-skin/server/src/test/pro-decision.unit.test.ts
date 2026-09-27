import { describe, it, expect } from 'vitest'
import { decide, isInnTakenError } from '../lib/pro-decision.js'

describe('pro-decision', () => {
  describe('decide', () => {
    it('should return pending and set green lane when registry hit found', () => {
      const registryHit = {
        name: 'ООО Тестовая компания',
        okvedMain: '85.42.11',
        okveds: ['85.42.11', '85.42.12'],
        state: 'ACTIVE',
      }

      const result = decide({
        registryHit,
        npd: 'unavailable',
      })

      // Автомат никогда не одобряет — всегда pending
      expect(result.status).toBe('pending')
      expect(result.source).toBeNull()
      // Но lane зелёный: приоритет для менеджера, что найдено в реестре
      expect(result.lane).toBe('green')
      expect(result.check.registry).toEqual({
        name: registryHit.name,
        okvedMain: registryHit.okvedMain,
        state: registryHit.state,
        source: 'dadata',
      })
    })

    it('should return pending and set yellow lane when registry hit not found', () => {
      const result = decide({
        registryHit: null,
        npd: 'self_employed',
      })

      expect(result.status).toBe('pending')
      expect(result.source).toBeNull()
      expect(result.lane).toBe('yellow')
      expect(result.check.registry).toBeNull()
      expect(result.check.npd).toBe('self_employed')
    })

    it('should always return pending status (never approved or rejected)', () => {
      const inputs = [
        { registryHit: null, npd: 'self_employed' as const },
        { registryHit: null, npd: 'not_self_employed' as const },
        { registryHit: null, npd: 'unavailable' as const },
        {
          registryHit: {
            name: 'Test',
            okvedMain: '85.42.11',
            okveds: ['85.42.11'],
            state: 'ACTIVE',
          },
          npd: 'self_employed' as const,
        },
      ]

      for (const input of inputs) {
        const result = decide(input)
        // Автомат принимает решение в пользу только pending — менеджер решает одобрить/отклонить
        expect(result.status).toBe('pending')
      }
    })

    it('should include all required fields in check', () => {
      const result = decide({
        registryHit: null,
        npd: 'not_self_employed',
      })

      expect(result.check).toHaveProperty('lane')
      expect(result.check).toHaveProperty('registry')
      expect(result.check).toHaveProperty('npd')
      expect(result.check).toHaveProperty('checkedAt')
      expect(result.check.checkedAt instanceof Date).toBe(true)
    })

    it('should set registry data when hit found', () => {
      const registryHit = {
        name: 'ИП Иванов И.И.',
        okvedMain: '85.41.10',
        okveds: ['85.41.10'],
        state: 'ACTIVE',
      }

      const result = decide({
        registryHit,
        npd: 'unavailable',
      })

      expect(result.check.registry).toEqual({
        name: 'ИП Иванов И.И.',
        okvedMain: '85.41.10',
        state: 'ACTIVE',
        source: 'dadata',
      })
    })

    it('should set registry to null when not found', () => {
      const result = decide({
        registryHit: null,
        npd: 'self_employed',
      })

      expect(result.check.registry).toBeNull()
    })

    it('should include NPD result in check', () => {
      const cases = [
        { npd: 'self_employed' as const },
        { npd: 'not_self_employed' as const },
        { npd: 'unavailable' as const },
      ]

      for (const { npd } of cases) {
        const result = decide({
          registryHit: null,
          npd,
        })
        expect(result.check.npd).toBe(npd)
      }
    })
  })
})

describe('isInnTakenError', () => {
  it('узнаёт нарушение по имени индекса и по списку колонок', () => {
    expect(isInnTakenError({ code: 'P2002', meta: { target: 'users_inn_approved_key' } })).toBe(true)
    expect(isInnTakenError({ code: 'P2002', meta: { target: ['inn'] } })).toBe(true)
  })
  it('не путает с другими ошибками', () => {
    expect(isInnTakenError({ code: 'P2002', meta: { target: ['email'] } })).toBe(false)
    expect(isInnTakenError({ code: 'P2025' })).toBe(false)
    expect(isInnTakenError(null)).toBe(false)
    expect(isInnTakenError(new Error('x'))).toBe(false)
  })
})
