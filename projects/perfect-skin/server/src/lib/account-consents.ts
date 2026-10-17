import type { Prisma } from './db.js'
import { CONSENT_TEXT_VERSION, RETAIL_AD_VERSIONS } from './consents.js'

type Tx = Prisma.TransactionClient

// Активное рекламное согласие покупателя. Рассылка для специалистов (marketing с другой версией) не в счёт.
export function activeRetailMarketingWhere(userId: string): Prisma.ConsentRecordWhereInput {
  return { userId, purpose: 'marketing', textVersion: { in: RETAIL_AD_VERSIONS }, revokedAt: null }
}

export async function grantRetailMarketing(tx: Tx, userId: string): Promise<void> {
  const active = await tx.consentRecord.findFirst({
    where: activeRetailMarketingWhere(userId),
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

// Отзыв рекламы — решение человека, а не заявки. Снимаем:
// - все его маркетинговые согласия в аккаунте: и покупательскую рекламу, и рассылку специалистам;
// - маркетинговые согласия из его заявок (по аккаунту или по телефону);
// - согласие самой заявки (consultationId), даже если заявка стёрта и сопоставить её не по чему.
// Согласия на обработку ПДн не трогаем. Пустой телефон не сопоставляем: так выглядят стёртые заявки.
export async function revokeMarketingConsents(
  tx: Tx,
  client: { userId: string | null; phone: string },
  revokedAt: Date,
  consultationId?: string,
): Promise<void> {
  const sameClient: Prisma.ConsultationRequestWhereInput[] = [
    ...(client.userId ? [{ userId: client.userId }] : []),
    ...(client.phone ? [{ phone: client.phone }] : []),
  ]
  const consentOr: Prisma.ConsultationConsentWhereInput[] = [
    ...(consultationId ? [{ consultationId }] : []),
    ...(sameClient.length > 0 ? [{ consultation: { OR: sameClient } }] : []),
  ]
  if (consentOr.length > 0) {
    await tx.consultationConsent.updateMany({
      where: { purpose: 'marketing', revokedAt: null, OR: consentOr },
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
