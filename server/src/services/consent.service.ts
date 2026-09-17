import { z } from 'zod'
import { CONSENT_VERSION, REVIEW_PUBLICATION_CONSENT_VERSION } from '@simba/shared'
import type { PrismaClient } from '@prisma/client'
import type { FastifyRequest } from 'fastify'

/** Редакции, которые сервер признаёт: журнал не должен ссылаться на текст, которого не было. */
export const PD_CONSENT_VERSIONS: readonly string[] = [CONSENT_VERSION]
export const REVIEW_CONSENT_VERSIONS: readonly string[] = [REVIEW_PUBLICATION_CONSENT_VERSION]

export const consentVersionSchema = (msg: string, allowed: readonly string[]) =>
  z.string({ required_error: msg, invalid_type_error: msg }).trim().refine((v) => allowed.includes(v), { message: msg })

export function consentSource(request: FastifyRequest) {
  const ua = request.headers['user-agent']
  return {
    ip: request.ip,
    userAgent: ua ? ua.slice(0, 512) : null,
  }
}

export async function recordConsent(
  db: PrismaClient,
  opts: {
    userId?: string | null
    kind: 'pd_processing' | 'review_publication' | 'withdrawal'
    textVersion: string
    orderId?: string | null
    reviewId?: string | null
    ip?: string | null
    userAgent?: string | null
  }
) {
  await db.consent.create({
    data: {
      userId: opts.userId || null,
      kind: opts.kind,
      textVersion: opts.textVersion,
      orderId: opts.orderId || null,
      reviewId: opts.reviewId || null,
      ip: opts.ip || null,
      userAgent: opts.userAgent || null,
    },
  })
}

export async function hasPdConsent(db: PrismaClient, userId: string): Promise<boolean> {
  const consent = await db.consent.findFirst({
    where: {
      userId,
      kind: 'pd_processing',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
  return !!consent
}
