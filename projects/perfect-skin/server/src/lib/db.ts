// Prisma-клиент Perfect Skin. По ADR у проекта СВОЙ клиент в .prisma/ps-client —
// импорт стандартного @prisma/client тянул бы клиента Симбы с чужой схемой.
//
// Пять уровней вверх — до корня репозитория, где лежит общий node_modules.
// Файл живёт в projects/<проект>/server/src/lib/: после переноса проектов
// в projects/ путь стал на уровень длиннее. Считать уровни на глаз здесь
// нельзя — промах не ловится, пока не установлены зависимости.
export * from '../../../../../node_modules/.prisma/ps-client/index.js'
export { PrismaClient, $Enums } from '../../../../../node_modules/.prisma/ps-client/index.js'

import { PrismaClient } from '../../../../../node_modules/.prisma/ps-client/index.js'

export const db = new PrismaClient()
