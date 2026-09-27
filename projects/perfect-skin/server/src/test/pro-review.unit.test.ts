import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApiError } from '../lib/errors.js'
import { reviewApplication } from '../services/pro-review.service.js'
import type { PrismaClient } from '@prisma/client'

// Мок Prisma с подставной реализацией для тестирования логики ревьюера
describe('pro-review.service', () => {
  describe('reviewApplication', () => {
    let prisma: any

    beforeEach(() => {
      // Создаём мок Prisma с основными методами
      prisma = {
        user: {
          findUnique: vi.fn(),
          updateMany: vi.fn(),
          update: vi.fn(),
        },
        proDocument: {
          updateMany: vi.fn(),
        },
        $transaction: vi.fn(async (callback) => callback(prisma)),
      }
    })

    it('should reject if reviewer is inactive', async () => {
      const inactiveReviewer = { id: 'reviewer-1', role: 'orders_manager', isActive: false }
      const applicant = {
        id: 'applicant-1',
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
        role: 'customer',
        proStatus: 'pending',
        proRequestedAt: new Date(),
        companyName: 'Test Company',
        inn: '123456789',
        specialization: 'Косметолог',
        createdAt: new Date(),
      }

      prisma.user.findUnique.mockResolvedValueOnce(inactiveReviewer) // Для ревьюера
      prisma.user.findUnique.mockResolvedValueOnce(applicant) // Для заявителя

      try {
        await reviewApplication(prisma, {
          applicantId: 'applicant-1',
          action: 'approve',
          expectedRequestedAt: applicant.proRequestedAt.toISOString(),
          reviewerId: 'reviewer-1',
          via: 'telegram',
        })
        throw new Error('Should have thrown FORBIDDEN')
      } catch (err: any) {
        expect(err.code).toBe('FORBIDDEN')
        expect(err.status).toBe(403)
      }
    })

    it('should reject if reviewer has wrong role', async () => {
      const wrongRoleReviewer = { id: 'reviewer-2', role: 'products_manager', isActive: true }
      const applicant = {
        id: 'applicant-1',
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
        role: 'customer',
        proStatus: 'pending',
        proRequestedAt: new Date(),
        companyName: 'Test Company',
        inn: '123456789',
        specialization: 'Косметолог',
        createdAt: new Date(),
      }

      prisma.user.findUnique.mockResolvedValueOnce(wrongRoleReviewer) // Для ревьюера

      try {
        await reviewApplication(prisma, {
          applicantId: 'applicant-1',
          action: 'approve',
          expectedRequestedAt: applicant.proRequestedAt.toISOString(),
          reviewerId: 'reviewer-2',
          via: 'telegram',
        })
        throw new Error('Should have thrown FORBIDDEN')
      } catch (err: any) {
        expect(err.code).toBe('FORBIDDEN')
        expect(err.status).toBe(403)
      }
    })

    it('should reject if reviewer does not exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null) // Для ревьюера

      try {
        await reviewApplication(prisma, {
          applicantId: 'applicant-1',
          action: 'approve',
          expectedRequestedAt: new Date().toISOString(),
          reviewerId: 'unknown-reviewer',
          via: 'telegram',
        })
        throw new Error('Should have thrown FORBIDDEN')
      } catch (err: any) {
        expect(err.code).toBe('FORBIDDEN')
        expect(err.status).toBe(403)
      }
    })

    it('should accept if reviewer is super_admin and active', async () => {
      const validReviewer = { id: 'reviewer-1', role: 'super_admin', isActive: true }
      const applicant = {
        id: 'applicant-1',
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
        role: 'customer',
        proStatus: 'pending',
        proRequestedAt: new Date(),
        companyName: 'Test Company',
        inn: '123456789',
        specialization: 'Косметолог',
        createdAt: new Date(),
      }
      const updatedApplicant = { ...applicant, proStatus: 'approved', proReviewedAt: new Date(), proRejectReason: null }

      // Мокируем findUnique для ревьюера и заявителя
      let callCount = 0
      prisma.user.findUnique.mockImplementation(() => {
        callCount++
        if (callCount === 1) return validReviewer // Первый вызов — ревьюер
        if (callCount === 2) return applicant // Второй вызов — заявитель
        if (callCount === 3) return updatedApplicant // Третий вызов — обновленный заявитель
        return null
      })

      prisma.$transaction.mockImplementationOnce(async (callback: any) => {
        const tx = {
          user: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn(),
          },
          proDocument: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        }
        return callback(tx)
      })

      const result = await reviewApplication(prisma, {
        applicantId: 'applicant-1',
        action: 'approve',
        expectedRequestedAt: applicant.proRequestedAt.toISOString(),
        reviewerId: 'reviewer-1',
        via: 'telegram',
      })

      expect(result.id).toBe('applicant-1')
      // Ревьюер был проверен на наличие и активность
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reviewer-1' },
        })
      )
    })

    it('should accept if reviewer is orders_manager and active', async () => {
      const validReviewer = { id: 'reviewer-2', role: 'orders_manager', isActive: true }
      const applicant = {
        id: 'applicant-1',
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
        role: 'customer',
        proStatus: 'pending',
        proRequestedAt: new Date(),
        companyName: 'Test Company',
        inn: '123456789',
        specialization: 'Косметолог',
        createdAt: new Date(),
      }
      const updatedApplicant = { ...applicant, proStatus: 'rejected', proReviewedAt: new Date(), proRejectReason: 'Тестовая причина' }

      let callCount = 0
      prisma.user.findUnique.mockImplementation(() => {
        callCount++
        if (callCount === 1) return validReviewer
        if (callCount === 2) return applicant
        if (callCount === 3) return updatedApplicant
        return null
      })

      prisma.$transaction.mockImplementationOnce(async (callback: any) => {
        const tx = {
          user: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn(),
          },
          proDocument: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        }
        return callback(tx)
      })

      const result = await reviewApplication(prisma, {
        applicantId: 'applicant-1',
        action: 'reject',
        reason: 'Тестовая причина',
        expectedRequestedAt: applicant.proRequestedAt.toISOString(),
        reviewerId: 'reviewer-2',
        via: 'telegram',
      })

      expect(result.id).toBe('applicant-1')
      expect(result.proRejectReason).toBe('Тестовая причина')
    })
  })
})
