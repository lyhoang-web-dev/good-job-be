import { format } from 'date-fns'
import { prisma } from '../../lib/prisma'
import { publishEvent } from '../../lib/redis'
import { AppError } from '../../middleware/errorHandler.middleware'
import { config } from '../../config'
import type { CoreValue, Prisma } from '@prisma/client'

export const KUDO_INCLUDE = {
  sender: { select: { id: true, name: true, avatarUrl: true } },
  receiver: { select: { id: true, name: true, avatarUrl: true } },
  media: true,
  reactions: {
    include: { user: { select: { id: true, name: true } } },
  },
  _count: { select: { comments: true } },
} satisfies Prisma.KudoInclude

export interface CreateKudoDto {
  receiverId: string
  points: number
  message: string
  coreValue: CoreValue
}

async function publishReactionsForKudo(kudoId: string) {
  const reactions = await prisma.reaction.findMany({
    where: { kudoId },
    include: { user: { select: { id: true, name: true } } },
  })
  await publishEvent('reaction:updated', { kudoId, reactions })
}

export const kudosService = {
  async createKudo(senderId: string, dto: CreateKudoDto) {
    if (senderId === dto.receiverId) {
      throw new AppError(400, 'Cannot send kudo to yourself')
    }

    const receiverExists = await prisma.user.findUnique({
      where: { id: dto.receiverId },
      select: { id: true },
    })
    if (!receiverExists) {
      throw new AppError(404, 'Receiver not found')
    }

    const yearMonth = format(new Date(), 'yyyy-MM')

    const kudo = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO giving_budgets (id, user_id, year_month, used_points, updated_at)
        VALUES ((gen_random_uuid())::text, ${senderId}, ${yearMonth}, 0, NOW())
        ON CONFLICT (user_id, year_month) DO NOTHING
      `

      const affected = await tx.$executeRaw`
        UPDATE giving_budgets
        SET used_points = used_points + ${dto.points}, updated_at = NOW()
        WHERE user_id = ${senderId}
          AND year_month = ${yearMonth}
          AND used_points + ${dto.points} <= ${config.GIVING_BUDGET}
      `

      if (affected === 0) {
        throw new AppError(400, 'Insufficient giving budget for this month')
      }

      const newKudo = await tx.kudo.create({
        data: {
          senderId,
          receiverId: dto.receiverId,
          points: dto.points,
          message: dto.message,
          coreValue: dto.coreValue,
          status: 'active',
        },
        include: KUDO_INCLUDE,
      })

      const updatedReceiver = await tx.user.update({
        where: { id: dto.receiverId },
        data: { balance: { increment: dto.points } },
        select: { balance: true },
      })

      await tx.pointLedger.create({
        data: {
          userId: dto.receiverId,
          amount: dto.points,
          balanceAfter: updatedReceiver.balance,
          type: 'received',
          kudoId: newKudo.id,
        },
      })

      await tx.notification.create({
        data: {
          userId: dto.receiverId,
          type: 'kudo_received',
          refId: newKudo.id,
          expiresAt: new Date(
            Date.now() +
              config.NOTIFICATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
          ),
        },
      })

      return newKudo
    })

    await publishEvent('kudo:created', kudo)
    await publishEvent(`notification:${dto.receiverId}`, {
      type: 'kudo_received',
      refId: kudo.id,
      message: `${kudo.sender.name} gave you a kudo!`,
    })

    return kudo
  },

  async getKudos(cursor?: string, limit = 20) {
    const kudos = await prisma.kudo.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      include: KUDO_INCLUDE,
    })

    const hasMore = kudos.length > limit
    const data = hasMore ? kudos.slice(0, limit) : kudos

    return {
      data: data.map((k) => ({ ...k, commentsCount: k._count.comments })),
      nextCursor: hasMore ? data[data.length - 1].id : undefined,
      hasMore,
    }
  },

  async addReaction(kudoId: string, userId: string, emoji: string) {
    if (!config.ALLOWED_REACTIONS.includes(emoji)) {
      throw new AppError(400, 'Invalid emoji')
    }

    const reaction = await prisma.reaction.create({
      data: { kudoId, userId, emoji },
    })

    await publishReactionsForKudo(kudoId)

    return reaction
  },

  async removeReaction(kudoId: string, userId: string, emoji: string) {
    const kudo = await prisma.kudo.findUnique({ where: { id: kudoId }, select: { id: true } })
    if (!kudo) throw new AppError(404, 'Kudo not found')

    await prisma.reaction.deleteMany({
      where: { kudoId, userId, emoji },
    })

    await publishReactionsForKudo(kudoId)
  },

  async getComments(kudoId: string) {
    return prisma.comment.findMany({
      where: { kudoId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })
  },

  async addComment(kudoId: string, userId: string, content: string) {
    if (content.trim().length === 0) {
      throw new AppError(400, 'Comment cannot be empty')
    }
    return prisma.comment.create({
      data: { kudoId, userId, content },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })
  },
}
