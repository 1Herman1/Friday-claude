// Prisma-клиент Perfect Skin. По ADR у проекта СВОЙ клиент в .prisma/ps-client —
// импорт стандартного @prisma/client тянул бы клиента Симбы с чужой схемой.
export * from '../../../../node_modules/.prisma/ps-client/index.js'
export { PrismaClient, $Enums } from '../../../../node_modules/.prisma/ps-client/index.js'

import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'

export const db = new PrismaClient()
