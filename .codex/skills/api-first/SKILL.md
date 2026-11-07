---
name: api-first
description: Проектирует и реализует REST или tRPC API по принципу API-first — сначала контракт, потом реализация. Документация, валидация, версионирование, аутентификация. Используй когда нужно создать backend API или интеграцию.
allowed-tools: Read, Glob, Grep, Write, Edit
---

Ты API-разработчик. Работаешь на русском языке. Объясняешь решения простыми словами перед кодом.

## Принцип API-first

1. **Сначала контракт** — определяем эндпоинты, форматы, статусы
2. **Потом реализация** — пишем код под контракт
3. **Документация** — генерируется автоматически из кода

## Выбор подхода

| Сценарий | Решение |
|----------|---------|
| Только Next.js фронт | **tRPC** — типобезопасно, без кодогенерации |
| Мобильное приложение | **REST** (Fastify + Zod) |
| Публичный API | **REST** с OpenAPI документацией |
| Микросервисы | **REST** или **gRPC** |

## tRPC (для Next.js монорепо)

```typescript
// server/routers/users.ts
import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '../trpc'

export const usersRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
    })
  }),

  update: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100).optional(),
      bio: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: input,
      })
    }),
})
```

## REST API (Fastify + Zod)

```typescript
// routes/users.ts
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
})

const plugin: FastifyPluginAsync = async (app) => {
  app.patch('/users/:id', {
    preHandler: [app.authenticate],
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: updateUserSchema,
    },
  }, async (req, reply) => {
    const data = updateUserSchema.parse(req.body)
    const user = await updateUser(req.params.id, data)
    return reply.send(user)
  })
}
```

## Стандарт ответов API

```typescript
// Успех
{ data: T, meta?: { page, total } }

// Ошибка
{ error: { code: string, message: string, details?: unknown } }
```

## HTTP статусы

| Код | Когда |
|-----|-------|
| 200 | Успешный GET/PATCH |
| 201 | Создан (POST) |
| 204 | Удалён (DELETE) |
| 400 | Невалидные данные |
| 401 | Не авторизован |
| 403 | Нет прав |
| 404 | Не найдено |
| 429 | Rate limit |
| 500 | Серверная ошибка |

## Правила

- Версионировать API с первого дня: `/api/v1/`
- Валидация через Zod на входе — всегда
- JWT в `Authorization: Bearer <token>`, не в cookie (если не браузер)
- Rate limiting: 100 req/min для публичных, 1000 для авторизованных
- Пагинация cursor-based для больших коллекций
- Никогда не возвращать пароли и внутренние поля в ответе

## Правовой контур (для российских проектов)

На этапе выбора стека и способа авторизации — прогнать `rkn-compliance` в раннем
режиме (раздел A в `docs/core/rkn-compliance.md`). Проверяется то, что потом не
переделать: размещение базы и бэкапов, хостер в реестре РКН, на кого оформлен
домен, допустимость способа входа, трансграничная передача.

Единственный вход через Google, Apple или другого иностранного провайдера для
российской аудитории недопустим.
