import type { PrismaClient } from '@prisma/client'
import { ApiError } from '../lib/errors.js'
import { isInnTakenError } from '../lib/pro-decision.js'
import { PRO_REVIEW_ROLES, STAFF_ROLES } from '../lib/pricing.js'
import { createMailSender } from './mail/index.js'

export interface ReviewApplicationInput {
  applicantId: string
  action: 'approve' | 'reject'
  reason?: string
  expectedRequestedAt?: string
  reviewerId: string
  via: 'admin' | 'telegram'
}

export interface ReviewApplicationResult {
  id: string
  name: string
  email: string | null
  phone: string | null
  companyName: string
  inn: string
  specialization: string
  proStatus: string
  proRequestedAt: string
  proReviewedAt: string | null
  proRejectReason: string | null
}

/**
 * Логика принятия решения по заявке специалиста.
 * Используется и админкой, и Telegram-ботом.
 */
export async function reviewApplication(
  prisma: PrismaClient,
  input: ReviewApplicationInput,
  mailSender: ReturnType<typeof createMailSender> | null = null,
  notifier: any = null
): Promise<ReviewApplicationResult> {
  const { applicantId, action, reason, expectedRequestedAt, reviewerId, via } = input

  // Проверяем, что ревьюер имеет нужную роль и активен (защита от подделки reviewerId)
  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { role: true, isActive: true },
  })

  if (!reviewer || !reviewer.isActive || !PRO_REVIEW_ROLES.includes(reviewer.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Недостаточно прав для рассмотрения заявок')
  }

  // Получаем пользователя
  const user = await prisma.user.findUnique({
    where: { id: applicantId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      proStatus: true,
      proRequestedAt: true,
      companyName: true,
      inn: true,
      specialization: true,
      createdAt: true,
    },
  })

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Пользователь не найден')
  }

  // Проверяем, что это не сотрудник (только обычные пользователи могут быть специалистами)
  if (STAFF_ROLES.includes(user.role)) {
    throw new ApiError(409, 'PRO_STAFF_ACCOUNT', 'Сотрудники не могут быть специалистами')
  }

  // Проверяем статус заявки в зависимости от действия
  if (action === 'reject' && user.proStatus !== 'pending' && user.proStatus !== 'approved') {
    throw new ApiError(409, 'PRO_NOT_PENDING', 'Заявка не на рассмотрении')
  }

  if (action === 'approve' && user.proStatus !== 'pending') {
    throw new ApiError(409, 'PRO_NOT_PENDING', 'Заявка не на рассмотрении')
  }

  // Для отклонения требуется причина
  if (action === 'reject' && !reason) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'При отклонении требуется указать причину', { field: 'reason' })
  }

  // Для pending заявок требуем expectedRequestedAt (защита от gонки)
  if (user.proStatus === 'pending' && !expectedRequestedAt) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'expectedRequestedAt обязателен для заявки в статусе pending', { field: 'expectedRequestedAt' })
  }

  const now = new Date()
  const deleteAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 дней

  try {
    await prisma.$transaction(async (tx: any) => {
      let updateResult

      if (user.proStatus === 'pending') {
        // Для pending заявок используем updateMany с проверкой на proRequestedAt
        updateResult = await tx.user.updateMany({
          where: {
            id: applicantId,
            proStatus: 'pending',
            proRequestedAt: new Date(expectedRequestedAt!),
          },
          data: {
            proStatus: action === 'approve' ? 'approved' : 'rejected',
            role: action === 'approve' ? 'professional' : (user.role === 'professional' ? 'customer' : user.role),
            proReviewedAt: now,
            proReviewerId: reviewerId,
            proRejectReason: action === 'reject' ? reason : null,
            proDecisionSource: 'manual',
          },
        })

        if (updateResult.count === 0) {
          // Заявка изменилась (подана заново) с момента открытия
          throw new ApiError(409, 'PRO_REQUEST_CHANGED', 'Заявка изменилась с момента открытия — обновите страницу')
        }
      } else {
        // Для reject уже одобренной (approved) используем обычный update
        await tx.user.update({
          where: { id: applicantId },
          data: {
            proStatus: 'rejected',
            role: user.role === 'professional' ? 'customer' : user.role,
            proReviewedAt: now,
            proReviewerId: reviewerId,
            proRejectReason: reason || null,
            proDecisionSource: 'manual',
          },
        })
      }

      // Устанавливаем deleteAfter для всех документов без deletedAt
      await tx.proDocument.updateMany({
        where: { userId: applicantId, deletedAt: null },
        data: { deleteAfter },
      })
    })
  } catch (err) {
    // Нарушение уникального индекса на INN для approved
    if (isInnTakenError(err)) {
      throw new ApiError(409, 'PRO_INN_TAKEN', 'Этот ИНН уже подтверждён для другого аккаунта')
    }
    throw err
  }

  const updatedUser = await prisma.user.findUnique({
    where: { id: applicantId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      companyName: true,
      inn: true,
      specialization: true,
      proStatus: true,
      proRequestedAt: true,
      proReviewedAt: true,
      proRejectReason: true,
    },
  })

  if (!updatedUser) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Пользователь не найден')
  }

  // Отправляем письмо пользователю (опционально, ошибки не валят решение)
  if (mailSender && updatedUser.email) {
    const subject = action === 'approve'
      ? 'Статус специалиста подтвержден'
      : 'Статус специалиста отклонен'
    const text = action === 'approve'
      ? 'Ваш статус специалиста подтвержден. Теперь в каталоге Perfect Skin вам показаны профессиональные цены.'
      : `Заявка на статус специалиста отклонена. Причина: ${reason}`

    try {
      await mailSender.sendPlain(updatedUser.email, subject, text)
    } catch (error) {
      // Логирование ошибки письма
    }
  }

  // Отправляем уведомление в Telegram (опционально, не блокирует ответ)
  if (notifier && updatedUser.proStatus !== 'none') {
    try {
      // Получаем имя сотрудника-ревьюера
      const reviewer = await prisma.user.findUnique({
        where: { id: reviewerId },
        select: { name: true },
      })
      const reviewerName = reviewer?.name || 'Сотрудник'
      await notifier.onDecision(applicantId, updatedUser.proStatus, reviewerName)
    } catch (error) {
      // Ошибки Telegram не валят решение
    }
  }

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email || null,
    phone: updatedUser.phone || null,
    companyName: updatedUser.companyName || '',
    inn: updatedUser.inn || '',
    specialization: updatedUser.specialization || '',
    proStatus: updatedUser.proStatus,
    proRequestedAt: updatedUser.proRequestedAt?.toISOString() || '',
    proReviewedAt: updatedUser.proReviewedAt ? updatedUser.proReviewedAt.toISOString() : null,
    proRejectReason: updatedUser.proRejectReason || null,
  }
}
