import { prisma } from '../../lib/prisma'
import { AppError } from '../../middleware/errorHandler.middleware'

export const notificationsService = {
  async list(userId: string) {
    return prisma.notification.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  },

  async markRead(userId: string, id: string) {
    const result = await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    })
    if (result.count === 0) {
      throw new AppError(404, 'Notification not found')
    }
  },

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
  },
}
