# Правила и соглашения

**Примечание:** правила ниже — универсальные для любого проекта. Реальные пути файлов и структура —
в `docs/projects/<проект>/project.md`. Примеры предполагают стек по умолчанию (см. `docs/core/stack.md`).

Доменные правила вынесены отдельно и читаются соответствующими ревьюерами:
- `docs/core/rules/react.md` — React (хуки, рендеры, компоненты) → `react-reviewer`
- `docs/core/rules/typescript.md` — TypeScript (типы, async, безопасность) → `typescript-reviewer`

## Именование

### Файлы и папки
- Компоненты React: `PascalCase.tsx` (например, `UserCard.tsx`)
- Хуки: `camelCase.ts` с префиксом `use` (например, `useAuth.ts`)
- Утилиты: `camelCase.ts` (например, `formatDate.ts`)
- Страницы (React): `PascalCase.tsx` в каталоге страниц проекта (например, `CartPage.tsx`)
- API роуты: по домену в каталоге роутов проекта (например, `orders.ts`, `auth.ts`)
- Типы: `types.ts` или `*.types.ts`

### Переменные и функции
- Переменные и функции: `camelCase`
- Константы: `UPPER_SNAKE_CASE`
- Типы и интерфейсы: `PascalCase`
- Enum: `PascalCase`, значения `UPPER_SNAKE_CASE`

### База данных (Prisma)
- Таблицы: `PascalCase` (User, Organization, Subscription)
- Поля: `camelCase` (createdAt, userId, organizationId)
- Обязательные поля на каждой таблице: `id`, `createdAt`, `updatedAt`
- Soft delete: `deletedAt DateTime?`

## Структура компонента

```tsx
// 1. Импорты (внешние → внутренние)
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

// 2. Типы
interface Props {
  userId: string
  onSuccess: () => void
}

// 3. Компонент
export function UserCard({ userId, onSuccess }: Props) {
  // 3.1 Хуки
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  // 3.2 Обработчики
  async function handleSubmit() {
    setLoading(true)
    try {
      await doSomething(userId)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  // 3.3 Рендер
  return (
    <div>
      <Button onClick={handleSubmit} disabled={loading}>
        Submit
      </Button>
    </div>
  )
}
```

## API роуты

Пример для стека по умолчанию (Fastify + TypeScript):

```typescript
// Роут для обновления пользователя
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function handlePatchUser(req: Request, reply: Reply) {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return reply.code(400).send({ success: false, error: parsed.error.flatten() })
  }

  // Проверка авторизации — пользователь меняет только своё (защита от IDOR)
  const { id } = req.params as { id: string }
  if (id !== req.user.userId) {
    return reply.code(403).send({ success: false, error: 'Forbidden' })
  }

  const user = await updateUser(id, parsed.data)
  return reply.send({ success: true, data: user })
}
```

Стандарт ответа API: `{ success: boolean, data?, error?, pagination? }`.

## Работа с БД

Всегда через слой сервисов/бизнес-логики, не прямо в роутах или компонентах:

```typescript
// Пример с Prisma (стек по умолчанию)
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, name: true, email: true },
  })
}
```

Конкретные пути сервисов — в `docs/projects/<проект>/project.md`.

## Переменные окружения

```
# .env (никогда не коммитить)
DATABASE_URL=            # postgresql://... (локальный Docker, не Supabase)
JWT_SECRET=              # секрет для подписи JWT
MINIO_ENDPOINT=          # хост MinIO
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=            # bucket для изображений товаров
OTP_TTL_SECONDS=         # срок жизни OTP-кода
# SMTP/SMS провайдер для отправки OTP (когда подключат)

# .env.example (коммитить — без значений)
DATABASE_URL=
JWT_SECRET=
MINIO_ENDPOINT=
...
```

## Обработка ошибок

- Не оборачивать в try/catch то что не может упасть
- На уровне API (Fastify): возвращать стандартные HTTP коды + `{ success: false, error }`
- На уровне UI: показывать toast / error state пользователю (три состояния: loading / error / data)
- В продакшне: логи через process manager проекта (см. `docs/projects/<проект>/project.md`)
- Пустой `catch {}` запрещён — либо обработать, либо пробросить (см. `silent-failure-hunter`)
