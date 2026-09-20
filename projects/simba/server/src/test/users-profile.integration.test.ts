import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { CONSENT_VERSION } from '@simba/shared'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, authHeader } from './factories'
import { otpService } from '../services/otp.service'

describe.skipIf(!hasTestDb)('Профиль пользователя: имя, телефон, смена почты', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    const { buildApp } = await import('../index')
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    if (app) await app.close()
    await closeTestPrisma()
  })

  beforeEach(async () => {
    await resetDb()
  })

  // Лимиты роутов живут в памяти процесса и ключуются по userId, resetDb их не
  // трогает. Поэтому каждому кейсу — свой пользователь через createUser().

  let emailCounter = 0
  const nextEmail = () => {
    emailCounter += 1
    return `new-${Date.now()}-${emailCounter}@example.test`
  }

  // У email-request появился лимит по IP (5 запросов / 15 минут), а карта живёт
  // в памяти процесса и между кейсами не сбрасывается. Каждому кейсу — свой IP.
  let ipCounter = 0
  const nextIp = () => {
    ipCounter += 1
    return `10.20.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`
  }

  const putProfile = (headers: Record<string, string>, payload: Record<string, unknown>) =>
    app.inject({ method: 'PUT', url: '/api/users/profile', headers, payload })

  const requestEmail = (headers: Record<string, string>, email: string, ip = nextIp()) =>
    app.inject({
      method: 'POST',
      url: '/api/users/profile/email-request',
      headers,
      remoteAddress: ip,
      payload: { email },
    })

  const confirmEmail = (
    headers: Record<string, string>,
    email: string,
    currentCode: string,
    code: string
  ) =>
    app.inject({
      method: 'PUT',
      url: '/api/users/profile/email',
      headers,
      payload: { email, currentCode, code },
    })

  // Коды в базе лежат sha256-хешем и оттуда не восстановимы, поэтому свою пару
  // тест выпускает сам — тем же сценарием и теми же адресами, что и роут:
  // currentCode уходит на текущий адрес аккаунта, code — на новый.
  const issueCodes = async (userId: string, currentEmail: string, newEmail: string) => {
    const prisma = getTestPrisma()
    return {
      currentCode: await otpService.createOtp(prisma, userId, 'email', 'email_change', currentEmail),
      code: await otpService.createOtp(prisma, userId, 'email', 'email_change', newEmail),
    }
  }

  const aliveChangeCodes = (userId: string) =>
    getTestPrisma().otpCode.count({ where: { userId, purpose: 'email_change', usedAt: null } })

  it('PUT /profile сохраняет имя и отдаёт объект как GET /api/auth/me', async () => {
    const prisma = getTestPrisma()
    const user = await createUser({ name: 'Старое имя' })

    const res = await putProfile(authHeader(app, user.id), { name: '  Герман  ' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.name).toBe('Герман')
    // Ответ должен быть полным объектом пользователя — клиент кладёт его прямо в state
    expect(body).toMatchObject({
      id: user.id,
      email: user.email,
      phone: null,
      role: 'customer',
      bonusPoints: 0,
      isGuest: false,
      hasPdConsent: true,
    })
    expect(Array.isArray(body.addresses)).toBe(true)
    expect(Array.isArray(body.pets)).toBe(true)

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.name).toBe('Герман')
  })

  it('PUT /profile сохраняет телефон в нормализованном виде', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()

    const res = await putProfile(authHeader(app, user.id), { phone: '+7 (999) 123-45-67' })

    expect(res.statusCode).toBe(200)
    expect(res.json().phone).toBe('79991234567')

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.phone).toBe('79991234567')
  })

  it('PUT /profile с пустой строкой в phone отвязывает телефон', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)

    await putProfile(headers, { phone: '89991234567' })
    const res = await putProfile(headers, { phone: '' })

    expect(res.statusCode).toBe(200)
    expect(res.json().phone).toBeNull()

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.phone).toBeNull()
  })

  it('PUT /profile с чужим телефоном → 409 и телефон не меняется', async () => {
    const prisma = getTestPrisma()
    const owner = await createUser()
    await prisma.user.update({ where: { id: owner.id }, data: { phone: '79991234567' } })

    const user = await createUser()
    const res = await putProfile(authHeader(app, user.id), { phone: '8 999 123-45-67' })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({ error: 'Этот телефон уже привязан к другому аккаунту' })

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.phone).toBeNull()
  })

  it('PUT /profile игнорирует email в теле запроса', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()

    const res = await putProfile(authHeader(app, user.id), {
      name: 'Герман',
      phone: '',
      email: 'ugnal@example.test',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().email).toBe(user.email)

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(user.email)
    expect(inDb.name).toBe('Герман')
  })

  it('PUT /profile гостевой сессией → 403', async () => {
    const guestToken = app.jwt.sign({ userId: 'guest-profile-1', type: 'guest' })

    const res = await putProfile({ authorization: `Bearer ${guestToken}` }, { name: 'Гость' })

    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'У гостевой сессии нет профиля' })
  })

  it('email-request на занятый адрес → 200: занятость адреса не раскрывается', async () => {
    // Иначе залогиненный перебором выясняет, кто из посторонних есть в базе
    // магазина: ответ на чужой адрес обязан совпадать с ответом на свободный.
    const other = await createUser()
    const user = await createUser()

    const res = await requestEmail(authHeader(app, user.id), other.email!.toUpperCase())

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    // И коды выпускаются как обычно — по времени ответа разницы тоже нет
    expect(await aliveChangeCodes(user.id)).toBe(2)
  })

  it('подтверждение на занятый адрес → 409', async () => {
    // Столкновение ловится здесь, на уникальном индексе, а не на шаге запроса
    const prisma = getTestPrisma()
    const other = await createUser()
    const user = await createUser()
    const headers = authHeader(app, user.id)

    const { currentCode, code } = await issueCodes(user.id, user.email!, other.email!)

    const res = await confirmEmail(headers, other.email!, currentCode, code)

    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({ error: 'Этот адрес уже занят' })

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(user.email)
  })

  it('email-request на свой же адрес → 400', async () => {
    const user = await createUser()

    const res = await requestEmail(authHeader(app, user.id), user.email!)

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Это ваш текущий адрес' })
  })

  it('полный цикл смены почты: запрос кода → подтверждение → вход по старому адресу невозможен', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const oldEmail = user.email!
    const newEmail = nextEmail()

    const requested = await requestEmail(headers, newEmail.toUpperCase())
    expect(requested.statusCode).toBe(200)
    expect(requested.json()).toEqual({ ok: true })
    // Роут выпустил ДВА кода — на текущий адрес и на новый
    expect(await aliveChangeCodes(user.id)).toBe(2)

    const { currentCode, code } = await issueCodes(user.id, oldEmail, newEmail)

    const confirmed = await confirmEmail(headers, newEmail.toUpperCase(), currentCode, code)
    expect(confirmed.statusCode).toBe(200)
    expect(confirmed.json().user.email).toBe(newEmail)

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(newEmail)

    // Старый адрес больше никому не принадлежит — войти по нему нельзя
    expect(await prisma.user.findFirst({ where: { email: oldEmail } })).toBeNull()
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { email: oldEmail, code: '123456', consentVersion: CONSENT_VERSION },
    })
    expect(oldLogin.statusCode).toBe(400)
  })

  it('неверный код при подтверждении → 400, адрес не изменился', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const newEmail = nextEmail()

    expect((await requestEmail(headers, newEmail)).statusCode).toBe(200)

    const res = await confirmEmail(headers, newEmail, '000000', '000000')

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Неверный или просроченный код' })

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(user.email)
  })

  it('повторный email-request в течение минуты → 429', async () => {
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const ip = nextIp()
    const newEmail = nextEmail()

    expect((await requestEmail(headers, newEmail, ip)).statusCode).toBe(200)

    const res = await requestEmail(headers, newEmail, ip)

    expect(res.statusCode).toBe(429)
    expect(res.json()).toEqual({ error: 'Повторный запрос возможен через 60 секунд' })
  })

  it('запрос на занятый адрес засчитывает лимит: следующий запрос → 429', async () => {
    // Перебор чужих адресов упирается в тот же лимит, что и обычный запрос
    const other = await createUser()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const ip = nextIp()

    const first = await requestEmail(headers, other.email!, ip)
    expect(first.statusCode).toBe(200)

    const second = await requestEmail(headers, nextEmail(), ip)
    expect(second.statusCode).toBe(429)
    expect(second.json()).toEqual({ error: 'Повторный запрос возможен через 60 секунд' })
  })

  it('код смены почты не годится для входа: POST /api/auth/verify-otp → 400', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const newEmail = nextEmail()

    expect((await requestEmail(headers, newEmail)).statusCode).toBe(200)
    const code = await otpService.createOtp(prisma, user.id, 'email', 'email_change', newEmail)

    // Опечатка в домене нового адреса не должна раздавать посторонним JWT на 7 дней
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { email: user.email, code, consentVersion: CONSENT_VERSION },
    })

    expect(login.statusCode).toBe(400)
    expect(login.json()).toEqual({ error: 'Неверный или истёкший код' })
  })

  it('код входа не подтверждает смену почты: PUT /profile/email → 400', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const newEmail = nextEmail()

    expect((await requestEmail(headers, newEmail)).statusCode).toBe(200)
    const currentCode = await otpService.createOtp(prisma, user.id, 'email', 'email_change', user.email)
    const loginCode = await otpService.createOtp(prisma, user.id, 'email', 'login', user.email)

    const res = await confirmEmail(headers, newEmail, currentCode, loginCode)

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Неверный или просроченный код' })

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(user.email)
  })

  it('верный код, но другой адрес → 400 и адрес не меняется', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const requestedEmail = nextEmail()
    const otherEmail = nextEmail()

    expect((await requestEmail(headers, requestedEmail)).statusCode).toBe(200)
    const { currentCode, code } = await issueCodes(user.id, user.email!, requestedEmail)

    const res = await confirmEmail(headers, otherEmail, currentCode, code)

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Неверный или просроченный код' })

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(user.email)

    // Коды не сгорели: на свой адрес пара по-прежнему работает
    const ok = await confirmEmail(headers, requestedEmail, currentCode, code)
    expect(ok.statusCode).toBe(200)
    expect(ok.json().user.email).toBe(requestedEmail)
  })

  it('верный код нового адреса + неверный код текущего → 400, оба кода живы', async () => {
    // Украденная сессия знает только то, что пришло на новый ящик. Без кода с
    // текущего адреса смена не проходит — аккаунт остаётся у владельца.
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const newEmail = nextEmail()

    const { currentCode, code } = await issueCodes(user.id, user.email!, newEmail)

    const res = await confirmEmail(headers, newEmail, '000000', code)

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Неверный или просроченный код' })

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(user.email)

    // Ни один код не погашен — верная пара доводит смену до конца
    expect(await aliveChangeCodes(user.id)).toBe(2)
    const ok = await confirmEmail(headers, newEmail, currentCode, code)
    expect(ok.statusCode).toBe(200)
    expect(ok.json().user.email).toBe(newEmail)
  })

  it('верный код текущего адреса + неверный код нового → 400, оба кода живы', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const newEmail = nextEmail()

    const { currentCode, code } = await issueCodes(user.id, user.email!, newEmail)

    const res = await confirmEmail(headers, newEmail, currentCode, '000000')

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Неверный или просроченный код' })

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(user.email)

    expect(await aliveChangeCodes(user.id)).toBe(2)
    const ok = await confirmEmail(headers, newEmail, currentCode, code)
    expect(ok.statusCode).toBe(200)
    expect(ok.json().user.email).toBe(newEmail)
  })

  it('коды перепутаны местами → 400, оба кода живы', async () => {
    // Код знает свой адрес (target), поэтому перестановка полей не проходит:
    // иначе пара сводилась бы к «любые два кода из почты».
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const newEmail = nextEmail()

    const { currentCode, code } = await issueCodes(user.id, user.email!, newEmail)

    const res = await confirmEmail(headers, newEmail, code, currentCode)

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Неверный или просроченный код' })

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(user.email)

    expect(await aliveChangeCodes(user.id)).toBe(2)
    const ok = await confirmEmail(headers, newEmail, currentCode, code)
    expect(ok.statusCode).toBe(200)
  })

  it('один код в обоих полях не закрывает обе роли → 400', async () => {
    // У кодов, выпущенных до появления target, адрес неизвестен и подходит к
    // любой проверке. Одна бумажка всё равно не считается за две.
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const newEmail = nextEmail()

    const legacyCode = await otpService.createOtp(prisma, user.id, 'email', 'email_change', null)

    const res = await confirmEmail(headers, newEmail, legacyCode, legacyCode)

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Неверный или просроченный код' })

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(user.email)
    expect(await aliveChangeCodes(user.id)).toBe(1)
  })

  it('оба кода верны → адрес меняется, оба кода погашены', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const newEmail = nextEmail()

    const { currentCode, code } = await issueCodes(user.id, user.email!, newEmail)

    const ok = await confirmEmail(headers, newEmail, currentCode, code)
    expect(ok.statusCode).toBe(200)
    expect(ok.json().user.email).toBe(newEmail)

    const codes = await prisma.otpCode.findMany({
      where: { userId: user.id, purpose: 'email_change' },
    })
    expect(codes).toHaveLength(2)
    expect(codes.every((otp) => otp.usedAt !== null)).toBe(true)

    // Повтор той же парой ничего не даёт — коды одноразовые. Идём свежим
    // токеном из ответа: прежний погашен вместе с остальными сессиями.
    const freshHeaders = { authorization: `Bearer ${ok.json().token}` }
    const again = await confirmEmail(freshHeaders, newEmail, currentCode, code)
    expect(again.statusCode).toBe(400)
    expect(again.json()).toEqual({ error: 'Неверный или просроченный код' })
  })

  it('смена адреса гасит ранее выданные токены, а свежий из ответа работает', async () => {
    // Ради этого и заводились два кода: сессию угнали, владелец вернул адрес
    // обратно — у злоумышленника не должно остаться живого токена на неделю.
    const prisma = getTestPrisma()
    const user = await createUser()
    const oldHeaders = authHeader(app, user.id, 'customer', { issuedSecondsAgo: 60 })
    const newEmail = nextEmail()

    const { currentCode, code } = await issueCodes(user.id, user.email!, newEmail)

    const ok = await confirmEmail(oldHeaders, newEmail, currentCode, code)
    expect(ok.statusCode).toBe(200)

    const { user: changed, token } = ok.json() as { user: { email: string }; token: string }
    expect(changed.email).toBe(newEmail)
    expect(typeof token).toBe('string')

    const inDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.sessionsValidFrom).not.toBeNull()

    // Токен, которым смену подтверждали, тоже мёртв — мы не знаем, чей он
    const stale = await app.inject({ method: 'GET', url: '/api/auth/me', headers: oldHeaders })
    expect(stale.statusCode).toBe(401)
    expect(stale.json()).toEqual({ error: 'Сессия завершена, войдите заново', code: 'SESSION_REVOKED' })

    // А свежий из ответа работает — покупателя не выбрасывает из аккаунта
    const fresh = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(fresh.statusCode).toBe(200)
    expect(fresh.json().email).toBe(newEmail)
  })

  it('запрос кода на смену почты не гасит код входа', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()
    const headers = authHeader(app, user.id)
    const loginCode = await otpService.createOtp(prisma, user.id, 'email', 'login', user.email!)

    expect((await requestEmail(headers, nextEmail())).statusCode).toBe(200)

    // Две открытые вкладки больше не перебивают коды друг друга
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { email: user.email, code: loginCode, consentVersion: CONSENT_VERSION },
    })

    expect(login.statusCode).toBe(200)
    expect(login.json().token).toBeTruthy()
  })
})
