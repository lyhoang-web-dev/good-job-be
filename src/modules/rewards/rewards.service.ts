import { type Reward, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { config } from '../../config'
import { AppError } from '../../middleware/errorHandler.middleware'
import type { RewardQuery } from './rewards.schema'

export interface RedeemDto {
  rewardId: string
  idempotencyKey: string
}

function withRewardCounts(r: Reward) {
  const claimed = r.quantityRedeemed
  const remaining = Math.max(0, r.quantityTotal - r.quantityRedeemed)
  return { ...r, claimed, remaining, total: r.quantityTotal }
}

export type RewardItem = ReturnType<typeof withRewardCounts>

export interface PaginatedRewards {
  data: RewardItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const rewardsService = {
  async getAll(query: RewardQuery): Promise<PaginatedRewards> {
    const { search, availability, sort, userBalance, page, limit } = query
    const lowMax = config.REWARD_LOW_STOCK_MAX_REMAINING
    const skip = (page - 1) * limit

    const baseWhere: Prisma.RewardWhereInput = {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(availability === 'affordable' && userBalance !== undefined
        ? { pointsCost: { lte: userBalance } }
        : {}),
    }

    const needsInMemory =
      availability === 'in_stock' ||
      availability === 'low_stock' ||
      sort === 'availability'

    if (needsInMemory) {
      const rows = await prisma.reward.findMany({ where: baseWhere })
      let result = rows.map(withRewardCounts)

      if (availability === 'in_stock') {
        result = result.filter((r) => r.remaining > 0)
      } else if (availability === 'low_stock') {
        result = result.filter((r) => r.remaining > 0 && r.remaining <= lowMax)
      }

      sortRewardRows(result, sort, lowMax)

      const total = result.length
      return {
        data: result.slice(skip, skip + limit),
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      }
    }

    const dbOrderBy: Prisma.RewardOrderByWithRelationInput =
      sort === 'cost_asc' ? { pointsCost: 'asc' } : { pointsCost: 'desc' }

    const [total, rows] = await Promise.all([
      prisma.reward.count({ where: baseWhere }),
      prisma.reward.findMany({
        where: baseWhere,
        orderBy: dbOrderBy,
        skip,
        take: limit,
      }),
    ])

    return {
      data: rows.map(withRewardCounts),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    }
  },

  async redeem(userId: string, dto: RedeemDto) {
    return prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<{ id: string; balance: number }[]>`
        SELECT id, balance FROM users WHERE id = ${userId} FOR UPDATE
      `
      const balance = users[0]?.balance ?? 0

      const existing = await tx.redemption.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { reward: true },
      })
      if (existing) {
        if (existing.userId !== userId) {
          throw new AppError(409, 'Idempotency key already used')
        }
        return existing
      }

      const reward = await tx.reward.findFirst({
        where: { id: dto.rewardId, isActive: true },
      })
      if (!reward) throw new AppError(404, 'Reward not found or inactive')

      if (balance < reward.pointsCost) {
        throw new AppError(
          400,
          `Insufficient balance. Need ${reward.pointsCost}, have ${balance}`,
        )
      }

      const reserved = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "rewards"
        SET "quantity_redeemed" = "quantity_redeemed" + 1,
            "updated_at" = NOW()
        WHERE "id" = ${dto.rewardId}
          AND "is_active" = true
          AND "quantity_redeemed" < "quantity_total"
        RETURNING "id"
      `
      if (!reserved.length) {
        throw new AppError(409, 'Reward is out of stock')
      }

      const debited = await tx.$queryRaw<{ balance: number }[]>`
        UPDATE "users"
        SET "balance" = "balance" - ${reward.pointsCost},
            "updated_at" = NOW()
        WHERE "id" = ${userId}
          AND "balance" >= ${reward.pointsCost}
        RETURNING "balance"
      `
      if (!debited.length) {
        throw new AppError(
          400,
          `Insufficient balance. Need ${reward.pointsCost}, have ${balance}`,
        )
      }
      const newBalance = debited[0].balance

      const redemption = await tx.redemption.create({
        data: {
          userId,
          rewardId: dto.rewardId,
          pointsSpent: reward.pointsCost,
          status: 'completed',
          idempotencyKey: dto.idempotencyKey,
        },
        include: { reward: true },
      })

      await tx.pointLedger.create({
        data: {
          userId,
          amount: -reward.pointsCost,
          balanceAfter: newBalance,
          type: 'redeemed',
          redemptionId: redemption.id,
        },
      })

      return redemption
    })
  },

  async getRedemptionHistory(userId: string) {
    return prisma.redemption.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { reward: true },
    })
  },

  async createReward(data: {
    name: string
    description?: string | null
    pointsCost: number
    imageUrl?: string | null
    quantityTotal: number
  }) {
    const row = await prisma.reward.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        pointsCost: data.pointsCost,
        imageUrl: data.imageUrl ?? null,
        quantityTotal: data.quantityTotal,
        quantityRedeemed: 0,
      },
    })
    return withRewardCounts(row)
  },

  async updateReward(
    id: string,
    data: Partial<{
      name: string
      description: string | null
      pointsCost: number
      imageUrl: string | null
      isActive: boolean
      quantityTotal: number
    }>,
  ) {
    const current = await prisma.reward.findUnique({ where: { id } })
    if (!current) throw new AppError(404, 'Reward not found')
    if (data.quantityTotal !== undefined) {
      if (data.quantityTotal < current.quantityRedeemed) {
        throw new AppError(
          400,
          `quantityTotal must be at least ${current.quantityRedeemed} (already claimed)`,
        )
      }
    }
    const row = await prisma.reward.update({ where: { id }, data })
    return withRewardCounts(row)
  },
}

type RewardRow = ReturnType<typeof withRewardCounts>

function sortRewardRows(
  rows: RewardRow[],
  sort: RewardQuery['sort'],
  lowStockMaxRemaining: number,
) {
  if (sort === 'availability') {
    rows.sort((a, b) => {
      if (a.remaining === 0 && b.remaining > 0) return 1
      if (a.remaining > 0 && b.remaining === 0) return -1
      if (a.remaining <= lowStockMaxRemaining && b.remaining > lowStockMaxRemaining)
        return -1
      if (a.remaining > lowStockMaxRemaining && b.remaining <= lowStockMaxRemaining)
        return 1
      return a.pointsCost - b.pointsCost
    })
    return
  }
  if (sort === 'cost_asc') {
    rows.sort((a, b) => a.pointsCost - b.pointsCost)
    return
  }
  rows.sort((a, b) => b.pointsCost - a.pointsCost)
}
