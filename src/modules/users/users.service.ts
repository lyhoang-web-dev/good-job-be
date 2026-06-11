import { format } from 'date-fns'
import type { Role } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../middleware/errorHandler.middleware'
import { config } from '../../config'
import { KUDO_INCLUDE } from '../kudos/kudos.service'

export const usersService = {
  async list(search?: string) {
    return prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        balance: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
      take: 100,
    })
  },

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        balance: true,
        createdAt: true,
      },
    })
    if (!user) throw new AppError(404, 'User not found')
    return user
  },

  async getUserKudos(
    viewerId: string,
    viewerRole: Role,
    targetUserId: string,
    direction: 'sent' | 'received',
  ) {
    if (viewerId !== targetUserId && viewerRole !== 'admin') {
      throw new AppError(403, 'Forbidden')
    }

    const where =
      direction === 'sent'
        ? { senderId: targetUserId, status: 'active' as const }
        : { receiverId: targetUserId, status: 'active' as const }

    const kudos = await prisma.kudo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: KUDO_INCLUDE,
    })

    return kudos.map((k) => ({ ...k, commentsCount: k._count.comments }))
  },

  async getGivingBudget(userId: string) {
    const yearMonth = format(new Date(), 'yyyy-MM')
    const row = await prisma.givingBudget.findUnique({
      where: { userId_yearMonth: { userId, yearMonth } },
    })
    const used = row?.usedPoints ?? 0
    return {
      yearMonth,
      usedPoints: used,
      budget: config.GIVING_BUDGET,
      remaining: Math.max(0, config.GIVING_BUDGET - used),
    }
  },
}
