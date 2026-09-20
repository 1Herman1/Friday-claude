import { describe, expect, it } from 'vitest'
import { settleOnCancel, settleOnPaid } from './order.service'

/**
 * Жизненный цикл бонусов заказа. Scoins — в рублях (1 scoin = 1 ₽).
 *
 * Правило: оформление только СПИСЫВАЕТ бонусы, начисление приходит при оплате.
 * Отмена/возврат возвращает списанное и снимает начисленное.
 * Флаги bonusEarnedCredited / bonusUsedRefunded — это защёлки: они не дают
 * начислить или вернуть одно и то же дважды.
 */

type CancelOrder = {
  bonusUsed: number
  bonusEarned: number
  bonusEarnedCredited: boolean
  bonusUsedRefunded: boolean
}

describe('A. settleOnPaid — начисление при оплате', () => {
  it('кейс 1: обычная оплата начисляет bonusEarned и взводит защёлку', () => {
    const r = settleOnPaid(
      { bonusEarned: 50, bonusEarnedCredited: false, bonusUsedRefunded: false },
      200
    )

    expect(r).toEqual({
      balanceDelta: 50,
      bonusEarnedCredited: true,
      bonusUsedRefunded: false,
    })
  })

  it('кейс 2: повторная оплата не начисляет второй раз', () => {
    const r = settleOnPaid(
      { bonusEarned: 50, bonusEarnedCredited: true, bonusUsedRefunded: false },
      250
    )

    expect(r).toEqual({
      balanceDelta: 0,
      bonusEarnedCredited: true,
      bonusUsedRefunded: false,
    })
  })

  it('кейс 3: нулевое начисление не двигает баланс и не взводит защёлку', () => {
    const r = settleOnPaid(
      { bonusEarned: 0, bonusEarnedCredited: false, bonusUsedRefunded: false },
      100
    )

    // Защёлка остаётся опущенной, но это безопасно: начислять всё равно нечего,
    // повторный вызов тоже даст ноль (проверяется тут же).
    expect(r).toEqual({
      balanceDelta: 0,
      bonusEarnedCredited: false,
      bonusUsedRefunded: false,
    })
    expect(settleOnPaid({ ...r, bonusEarned: 0 }, 100).balanceDelta).toBe(0)
  })

  it('кейс 3a: оплата уже отменённого заказа ничего не начисляет', () => {
    // Заказ отменён (bonusUsedRefunded = true): списанное покупателю вернули,
    // товар он не получил. Начислить сверху — значит превратить отмену в подарок.
    const r = settleOnPaid(
      { bonusEarned: 50, bonusEarnedCredited: false, bonusUsedRefunded: true },
      1000
    )

    expect(r).toEqual({
      balanceDelta: 0,
      bonusEarnedCredited: false,
      bonusUsedRefunded: true,
    })
  })

  it('кейс 3b: оплата переносит bonusUsedRefunded, а не обнуляет его', () => {
    // Ключевая защита от двойного возврата: если бы оплата сбрасывала защёлку
    // возврата в false, следующий возврат платежа вернул бы bonusUsed повторно.
    const r = settleOnPaid(
      { bonusEarned: 50, bonusEarnedCredited: true, bonusUsedRefunded: true },
      1000
    )

    expect(r).toEqual({
      balanceDelta: 0,
      bonusEarnedCredited: true,
      bonusUsedRefunded: true,
    })
  })

  it('кейс 4: результат оплаты не зависит от текущего баланса', () => {
    const order = {
      bonusEarned: 50,
      bonusEarnedCredited: false,
      bonusUsedRefunded: false,
    }

    const atZero = settleOnPaid(order, 0)
    const atSmall = settleOnPaid(order, 7)
    const atHuge = settleOnPaid(order, 1_000_000)

    expect(atZero).toEqual(atSmall)
    expect(atSmall).toEqual(atHuge)
    expect(atZero.balanceDelta).toBe(50)
  })
})

describe('B. settleOnCancel — возврат при отмене и возврате платежа', () => {
  it('кейс 5: отмена неоплаченного заказа возвращает списанное и ничего не снимает', () => {
    // Начисления не было (bonusEarnedCredited = false) — снимать нечего.
    const r = settleOnCancel(
      {
        bonusUsed: 300,
        bonusEarned: 35,
        bonusEarnedCredited: false,
        bonusUsedRefunded: false,
      },
      700
    )

    expect(r).toEqual({
      balanceDelta: 300,
      bonusEarnedCredited: false,
      bonusUsedRefunded: true,
    })
  })

  it('кейс 6: отмена оплаченного заказа возвращает списанное и снимает начисленное', () => {
    // Было 1000 → оформление списало 300 → оплата начислила 35 → баланс 735.
    // Отмена обязана вернуть ровно в исходную 1000.
    const r = settleOnCancel(
      {
        bonusUsed: 300,
        bonusEarned: 35,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      735
    )

    expect(r).toEqual({
      balanceDelta: 265,
      bonusEarnedCredited: false,
      bonusUsedRefunded: true,
    })
    expect(735 + r.balanceDelta).toBe(1000)
  })

  it('кейс 7: заказ без бонусов вообще — ноль и при первом, и при повторном вызове', () => {
    const order: CancelOrder = {
      bonusUsed: 0,
      bonusEarned: 0,
      bonusEarnedCredited: false,
      bonusUsedRefunded: false,
    }

    const first = settleOnCancel(order, 500)

    // Фактическое поведение: защёлки не взводятся (возвращать и снимать нечего).
    expect(first).toEqual({
      balanceDelta: 0,
      bonusEarnedCredited: false,
      bonusUsedRefunded: false,
    })

    const second = settleOnCancel(
      {
        ...order,
        bonusEarnedCredited: first.bonusEarnedCredited,
        bonusUsedRefunded: first.bonusUsedRefunded,
      },
      500 + first.balanceDelta
    )
    expect(second.balanceDelta).toBe(0)
  })

  it('кейс 8: повторная отмена не возвращает списанное второй раз', () => {
    const r = settleOnCancel(
      {
        bonusUsed: 300,
        bonusEarned: 35,
        bonusEarnedCredited: false,
        bonusUsedRefunded: true,
      },
      1000
    )

    expect(r).toEqual({
      balanceDelta: 0,
      bonusEarnedCredited: false,
      bonusUsedRefunded: true,
    })
  })

  it('кейс 9: снятие начисленного не уводит баланс в минус', () => {
    // Начислили 100, покупатель успел потратить — на балансе 30.
    // Снимаем только доступные 30, а не 100.
    const r = settleOnCancel(
      {
        bonusUsed: 0,
        bonusEarned: 100,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      30
    )

    expect(r).toEqual({
      balanceDelta: -30,
      bonusEarnedCredited: false,
      bonusUsedRefunded: false,
    })
    expect(30 + r.balanceDelta).toBe(0)
  })

  it('кейс 10: возврат списанного и снятие начисленного в одном расчёте', () => {
    // Баланс просел до 50, но возврат 200 идёт первым и делает снятие 100 возможным.
    const r = settleOnCancel(
      {
        bonusUsed: 200,
        bonusEarned: 100,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      50
    )

    expect(r).toEqual({
      balanceDelta: 100,
      bonusEarnedCredited: false,
      bonusUsedRefunded: true,
    })
    expect(50 + r.balanceDelta).toBe(150)
  })

  it('кейс 10a: баланс 0 и снимать нечего — начисленное списывается в убыток магазина', () => {
    // Осознанный размен: баланс покупателя важнее «долга». Защёлка всё равно
    // опускается, иначе повторная отмена будет снова пытаться снять эти 100.
    const r = settleOnCancel(
      {
        bonusUsed: 0,
        bonusEarned: 100,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      0
    )

    expect(r).toEqual({
      balanceDelta: 0,
      bonusEarnedCredited: false,
      bonusUsedRefunded: false,
    })
  })

  it('кейс 10b: возвращённое списание покрывает снятие начисленного, итог — ноль', () => {
    // Возврат 50 идёт первым, снять можно только эти же 50 из 100.
    const r = settleOnCancel(
      {
        bonusUsed: 50,
        bonusEarned: 100,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      0
    )

    expect(r).toEqual({
      balanceDelta: 0,
      bonusEarnedCredited: false,
      bonusUsedRefunded: true,
    })
    expect(0 + r.balanceDelta).toBe(0)
  })

  it('кейс 10c: на большом балансе начисленное снимается целиком', () => {
    const r = settleOnCancel(
      {
        bonusUsed: 0,
        bonusEarned: 100,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      5000
    )

    expect(r).toEqual({
      balanceDelta: -100,
      bonusEarnedCredited: false,
      bonusUsedRefunded: false,
    })
  })

  it('кейс 10d: аномально отрицательный баланс отмена не трогает', () => {
    // При корректных данных недостижимо (списание защищено условным updateMany).
    // Если минус всё же появился — отмена не углубляет его, но и не «начисляет»
    // подтягиванием к нулю: снимать нечего, значит дельта ровно ноль.
    const r = settleOnCancel(
      {
        bonusUsed: 0,
        bonusEarned: 100,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      -10
    )

    expect(r.balanceDelta).toBe(0)
    expect(-10 + r.balanceDelta).toBe(-10)
    expect(r.bonusEarnedCredited).toBe(false)
  })
})

describe('C. инварианты жизненного цикла (I1–I5)', () => {
  const cases: { name: string; order: CancelOrder; balance: number }[] = [
    {
      name: 'оплаченный заказ со списанием',
      order: {
        bonusUsed: 300,
        bonusEarned: 35,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      balance: 735,
    },
    {
      name: 'неоплаченный заказ со списанием',
      order: {
        bonusUsed: 300,
        bonusEarned: 35,
        bonusEarnedCredited: false,
        bonusUsedRefunded: false,
      },
      balance: 700,
    },
    {
      name: 'начислено, списания не было',
      order: {
        bonusUsed: 0,
        bonusEarned: 100,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      balance: 100,
    },
    {
      name: 'начисленное уже потрачено',
      order: {
        bonusUsed: 0,
        bonusEarned: 100,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      balance: 30,
    },
    {
      name: 'баланс обнулён',
      order: {
        bonusUsed: 0,
        bonusEarned: 100,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      balance: 0,
    },
    {
      name: 'заказ уже отменён',
      order: {
        bonusUsed: 300,
        bonusEarned: 35,
        bonusEarnedCredited: false,
        bonusUsedRefunded: true,
      },
      balance: 1000,
    },
    {
      name: 'оплачен после отмены',
      order: {
        bonusUsed: 300,
        bonusEarned: 35,
        bonusEarnedCredited: true,
        bonusUsedRefunded: true,
      },
      balance: 1035,
    },
    {
      name: 'заказ без бонусов',
      order: {
        bonusUsed: 0,
        bonusEarned: 0,
        bonusEarnedCredited: false,
        bonusUsedRefunded: false,
      },
      balance: 500,
    },
    {
      name: 'мелкий чек: списание есть, начисления нет',
      order: {
        bonusUsed: 5,
        bonusEarned: 0,
        bonusEarnedCredited: false,
        bonusUsedRefunded: false,
      },
      balance: 10,
    },
    {
      name: 'крупные суммы',
      order: {
        bonusUsed: 49999,
        bonusEarned: 25000,
        bonusEarnedCredited: true,
        bonusUsedRefunded: false,
      },
      balance: 100000,
    },
  ]

  it.each(cases)('I1: баланс не уходит в минус ни оплатой, ни отменой ($name)', ({ order, balance }) => {
    expect(balance + settleOnPaid(order, balance).balanceDelta).toBeGreaterThanOrEqual(0)
    expect(balance + settleOnCancel(order, balance).balanceDelta).toBeGreaterThanOrEqual(0)
  })

  it.each(cases)('I2: повторный расчёт с новыми защёлками даёт ноль ($name)', ({ order, balance }) => {
    const paid = settleOnPaid(order, balance)
    const paidAgain = settleOnPaid(
      {
        ...order,
        bonusEarnedCredited: paid.bonusEarnedCredited,
        bonusUsedRefunded: paid.bonusUsedRefunded,
      },
      balance + paid.balanceDelta
    )
    expect(paidAgain.balanceDelta).toBe(0)

    const cancelled = settleOnCancel(order, balance)
    const cancelledAgain = settleOnCancel(
      {
        ...order,
        bonusEarnedCredited: cancelled.bonusEarnedCredited,
        bonusUsedRefunded: cancelled.bonusUsedRefunded,
      },
      balance + cancelled.balanceDelta
    )
    expect(cancelledAgain.balanceDelta).toBe(0)
  })

  it.each(cases)('I3: дельта не выходит за границы самого заказа ($name)', ({ order, balance }) => {
    const paid = settleOnPaid(order, balance)
    // Оплата только начисляет и не больше, чем записано в заказе.
    expect(paid.balanceDelta).toBeGreaterThanOrEqual(0)
    expect(paid.balanceDelta).toBeLessThanOrEqual(order.bonusEarned)

    const cancelled = settleOnCancel(order, balance)
    // Отмена не возвращает больше, чем списали, и не снимает больше, чем начислили.
    expect(cancelled.balanceDelta).toBeLessThanOrEqual(order.bonusUsed)
    expect(cancelled.balanceDelta).toBeGreaterThanOrEqual(-order.bonusEarned)
  })

  it.each(cases)('I4: защёлки не откатываются назад ($name)', ({ order, balance }) => {
    const paid = settleOnPaid(order, balance)
    // Оплата переносит защёлку возврата как есть — иначе двойной возврат.
    expect(paid.bonusUsedRefunded).toBe(order.bonusUsedRefunded)
    if (order.bonusEarnedCredited) expect(paid.bonusEarnedCredited).toBe(true)

    const cancelled = settleOnCancel(order, balance)
    // Отмена не сбрасывает уже сделанный возврат и не выдаёт начисление.
    if (order.bonusUsedRefunded) expect(cancelled.bonusUsedRefunded).toBe(true)
    if (!order.bonusEarnedCredited) expect(cancelled.bonusEarnedCredited).toBe(false)
  })

  it.each(cases)('I5: все поля результата — целые числа ($name)', ({ order, balance }) => {
    for (const r of [settleOnPaid(order, balance), settleOnCancel(order, balance)]) {
      expect(Number.isInteger(r.balanceDelta)).toBe(true)
      expect(typeof r.bonusEarnedCredited).toBe('boolean')
      expect(typeof r.bonusUsedRefunded).toBe('boolean')
    }
  })
})

describe('D. сквозные сценарии жизненного цикла', () => {
  /** Прогоняет расчёт и возвращает новое состояние «пользователь + заказ». */
  function apply(
    settle: (order: CancelOrder, balance: number) => {
      balanceDelta: number
      bonusEarnedCredited: boolean
      bonusUsedRefunded: boolean
    },
    state: { order: CancelOrder; balance: number }
  ) {
    const r = settle(state.order, state.balance)
    return {
      balance: state.balance + r.balanceDelta,
      order: {
        ...state.order,
        bonusEarnedCredited: r.bonusEarnedCredited,
        bonusUsedRefunded: r.bonusUsedRefunded,
      },
    }
  }

  const order: CancelOrder = {
    bonusUsed: 300,
    bonusEarned: 35,
    bonusEarnedCredited: false,
    bonusUsedRefunded: false,
  }

  it('оформление → оплата → отмена возвращает баланс в исходное состояние', () => {
    // Оформление списывает 300 вне settle-функций: 1000 → 700.
    let state = { order, balance: 700 }

    state = apply(settleOnPaid, state)
    expect(state.balance).toBe(735)

    state = apply(settleOnCancel, state)
    expect(state.balance).toBe(1000)
  })

  it('двойная отмена оплаченного заказа не возвращает бонусы дважды', () => {
    let state = apply(settleOnPaid, { order, balance: 700 })

    state = apply(settleOnCancel, state)
    const afterFirst = state.balance
    state = apply(settleOnCancel, state)

    expect(state.balance).toBe(afterFirst)
    expect(state.balance).toBe(1000)
  })

  it('отмена → оплата → возврат платежа: списанное возвращается ровно один раз', () => {
    // Самый опасный порядок: если бы оплата сбрасывала bonusUsedRefunded,
    // возврат платежа выдал бы те же 300 повторно и баланс стал бы 1300.
    let state = { order, balance: 700 }

    state = apply(settleOnCancel, state)
    expect(state.balance).toBe(1000)
    expect(state.order.bonusUsedRefunded).toBe(true)

    // Оплата отменённого заказа ничего не начисляет: расчёт уже откатан.
    state = apply(settleOnPaid, state)
    expect(state.balance).toBe(1000)
    expect(state.order.bonusUsedRefunded).toBe(true)

    // И повторная отмена не возвращает списанное второй раз.
    state = apply(settleOnCancel, state)
    expect(state.balance).toBe(1000)
  })

  it('заказ без бонусов проходит весь цикл, не двигая баланс', () => {
    const empty: CancelOrder = {
      bonusUsed: 0,
      bonusEarned: 0,
      bonusEarnedCredited: false,
      bonusUsedRefunded: false,
    }

    let state = { order: empty, balance: 500 }
    state = apply(settleOnPaid, state)
    state = apply(settleOnCancel, state)
    state = apply(settleOnPaid, state)

    expect(state.balance).toBe(500)
  })
})
