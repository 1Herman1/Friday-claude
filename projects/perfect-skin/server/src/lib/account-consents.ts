import type { Prisma } from './db.js'
import { CONSENT_TEXT_VERSION } from './consents.js'

type Tx = Prisma.TransactionClient

// Рекламное согласие: любое активное уже покрывает человека, версия здесь не важна
export async function grantRetailMarketing(tx: Tx, userId: string): Promise<void> {
  const active = await tx.consentRecord.findFirst({
    where: { userId, purpose: 'marketing', revokedAt: null },
    select: { id: true },
  })
  if (active) return

  await tx.consentRecord.create({
    data: { userId, purpose: 'marketing', textVersion: CONSENT_TEXT_VERSION.retail_marketing },
  })
}

// Галочки при входе: не отмеченное ничего не отзывает
export async function grantSignInConsents(
  tx: Tx,
  userId: string,
  consents: { personalData: boolean; marketing: boolean },
): Promise<void> {
  if (consents.personalData) {
    const active = await tx.consentRecord.findFirst({
      where: { userId, purpose: 'account', textVersion: CONSENT_TEXT_VERSION.account, revokedAt: null },
      select: { id: true },
    })
    if (!active) {
      await tx.consentRecord.create({
        data: { userId, purpose: 'account', textVersion: CONSENT_TEXT_VERSION.account },
      })
    }
  }

  if (consents.marketing) {
    await grantRetailMarketing(tx, userId)
  }
}

// Отзыв рекламы — решение человека, а не заявки: снимаем во всех его заявках
// (по аккаунту или по телефону) и во всех его записях о согласии.
// Пустой телефон не сопоставляем: так выглядят стёртые заявки, они чужие.
export async function revokeMarketingConsents(
  tx: Tx,
  client: { userId: string | null; phone: string },
  revokedAt: Date,
): Promise<void> {
  const sameClient: Prisma.ConsultationRequestWhereInput[] = [
    ...(client.userId ? [{ userId: client.userId }] : []),
    ...(client.phone ? [{ phone: client.phone }] : []),
  ]
  if (sameClient.length > 0) {
    await tx.consultationConsent.updateMany({
      where: { purpose: 'marketing', revokedAt: null, consultation: { OR: sameClient } },
      data: { revokedAt },
    })
  }

  if (client.userId) {
    await tx.consentRecord.updateMany({
      where: { userId: client.userId, purpose: 'marketing', revokedAt: null },
      data: { revokedAt },
    })
  }
}
