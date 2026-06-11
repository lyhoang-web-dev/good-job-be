import type { RewardQuery } from '@/modules/rewards/rewards.schema'
import { rewardsService } from '@/modules/rewards/rewards.service'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    reward: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    redemption: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    pointLedger: { create: jest.fn() },
  },
}))

const mockPrisma = prisma as unknown as jest.Mocked<typeof prisma>
const reward = {
  id: 'r1',
  name: 'Hoodie',
  pointsCost: 500,
  isActive: true,
  quantityTotal: 100,
  quantityRedeemed: 0,
  description: null,
  imageUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}
const userId = 'user-1'
const dto = { rewardId: 'r1', idempotencyKey: 'key-123' }

function mockTxSuccess(balanceBefore: number, balanceAfter: number) {
  ;(mockPrisma.$queryRaw as jest.Mock)
    .mockResolvedValueOnce([{ id: userId, balance: balanceBefore }])
    .mockResolvedValueOnce([{ id: 'r1' }])
    .mockResolvedValueOnce([{ balance: balanceAfter }])
}

describe('rewardsService.redeem', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockPrisma.redemption.findUnique as jest.Mock).mockResolvedValue(null)
  })

  it('throws 404 when reward not found or inactive', async () => {
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        ;(mockPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
          { id: userId, balance: 600 },
        ])
        ;(mockPrisma.reward.findFirst as jest.Mock).mockResolvedValue(null)
        return fn(mockPrisma)
      },
    )
    await expect(rewardsService.redeem(userId, dto)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('throws 400 when balance insufficient', async () => {
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        ;(mockPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
          { id: userId, balance: 300 },
        ])
        ;(mockPrisma.reward.findFirst as jest.Mock).mockResolvedValue(reward)
        return fn(mockPrisma)
      },
    )
    await expect(rewardsService.redeem(userId, dto)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 409 when out of stock', async () => {
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        ;(mockPrisma.$queryRaw as jest.Mock)
          .mockResolvedValueOnce([{ id: userId, balance: 600 }])
          .mockResolvedValueOnce([])
        ;(mockPrisma.reward.findFirst as jest.Mock).mockResolvedValue(reward)
        return fn(mockPrisma)
      },
    )
    await expect(rewardsService.redeem(userId, dto)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('deducts balance and inserts ledger on success', async () => {
    const fakeRedemption = { id: 'red-1', reward }
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        mockTxSuccess(600, 100)
        ;(mockPrisma.reward.findFirst as jest.Mock).mockResolvedValue(reward)
        ;(mockPrisma.redemption.create as jest.Mock).mockResolvedValue(
          fakeRedemption,
        )
        ;(mockPrisma.pointLedger.create as jest.Mock).mockResolvedValue({})
        return fn(mockPrisma)
      },
    )

    const result = await rewardsService.redeem(userId, dto)
    expect(result.id).toBe('red-1')
    expect(mockPrisma.pointLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: -500,
          balanceAfter: 100,
          type: 'redeemed',
        }),
      }),
    )
  })

  it('returns existing redemption when idempotency key matches same user', async () => {
    const existing = { id: 'red-old', userId, reward }
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        ;(mockPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
          { id: userId, balance: 600 },
        ])
        ;(mockPrisma.redemption.findUnique as jest.Mock).mockResolvedValue(
          existing,
        )
        return fn(mockPrisma)
      },
    )

    const result = await rewardsService.redeem(userId, dto)
    expect(result).toBe(existing)
    expect(mockPrisma.reward.findFirst).not.toHaveBeenCalled()
  })

  it('throws 409 when idempotency key belongs to another user', async () => {
    const existing = { id: 'red-old', userId: 'other-user', reward }
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        ;(mockPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
          { id: userId, balance: 600 },
        ])
        ;(mockPrisma.redemption.findUnique as jest.Mock).mockResolvedValue(
          existing,
        )
        return fn(mockPrisma)
      },
    )

    await expect(rewardsService.redeem(userId, dto)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('throws on duplicate idempotency key without updating balance', async () => {
    const p2002 = Object.assign(new Error('Unique constraint'), {
      code: 'P2002',
    })
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        mockTxSuccess(600, 100)
        ;(mockPrisma.reward.findFirst as jest.Mock).mockResolvedValue(reward)
        ;(mockPrisma.redemption.create as jest.Mock).mockRejectedValue(p2002)
        return fn(mockPrisma)
      },
    )

    await expect(rewardsService.redeem(userId, dto)).rejects.toBeDefined()
    expect(mockPrisma.pointLedger.create).not.toHaveBeenCalled()
  })

  it('allows redeeming exactly at balance (boundary)', async () => {
    const fakeRedemption = { id: 'red-2', reward }
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        mockTxSuccess(500, 0)
        ;(mockPrisma.reward.findFirst as jest.Mock).mockResolvedValue(reward)
        ;(mockPrisma.redemption.create as jest.Mock).mockResolvedValue(
          fakeRedemption,
        )
        ;(mockPrisma.pointLedger.create as jest.Mock).mockResolvedValue({})
        return fn(mockPrisma)
      },
    )

    await expect(rewardsService.redeem(userId, dto)).resolves.toBeDefined()
    expect(mockPrisma.pointLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ balanceAfter: 0 }),
      }),
    )
  })

  it('rejects when 1 point short of balance', async () => {
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        ;(mockPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
          { id: userId, balance: 499 },
        ])
        ;(mockPrisma.reward.findFirst as jest.Mock).mockResolvedValue(reward)
        return fn(mockPrisma)
      },
    )
    await expect(rewardsService.redeem(userId, dto)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 400 when balance UPDATE returns no rows (race)', async () => {
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        ;(mockPrisma.$queryRaw as jest.Mock)
          .mockResolvedValueOnce([{ id: userId, balance: 600 }])
          .mockResolvedValueOnce([{ id: 'r1' }])
          .mockResolvedValueOnce([])
        ;(mockPrisma.reward.findFirst as jest.Mock).mockResolvedValue(reward)
        ;(mockPrisma.redemption.create as jest.Mock).mockResolvedValue({
          id: 'r',
          reward,
        })
        return fn(mockPrisma)
      },
    )
    await expect(rewardsService.redeem(userId, dto)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Insufficient balance'),
    })
    expect(mockPrisma.pointLedger.create).not.toHaveBeenCalled()
  })
})

function baseQuery(over: Partial<RewardQuery> = {}): RewardQuery {
  return {
    search: undefined,
    availability: 'all',
    sort: 'cost_desc',
    userBalance: undefined,
    page: 1,
    limit: 10,
    ...over,
  }
}

describe('rewardsService.getAll', () => {
  beforeEach(() => jest.clearAllMocks())

  it('uses DB pagination with count + findMany (cost_desc)', async () => {
    ;(mockPrisma.reward.count as jest.Mock).mockResolvedValue(2)
    ;(mockPrisma.reward.findMany as jest.Mock).mockResolvedValue([
      reward,
      { ...reward, id: 'r2', pointsCost: 100 },
    ])

    const out = await rewardsService.getAll(baseQuery({ sort: 'cost_desc' }))
    expect(out.total).toBe(2)
    expect(out.data).toHaveLength(2)
    expect(mockPrisma.reward.count).toHaveBeenCalled()
  })

  it('applies search filter in DB path', async () => {
    ;(mockPrisma.reward.count as jest.Mock).mockResolvedValue(1)
    ;(mockPrisma.reward.findMany as jest.Mock).mockResolvedValue([reward])

    await rewardsService.getAll(
      baseQuery({ search: 'hood', sort: 'cost_desc' }),
    )
    expect(mockPrisma.reward.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    )
  })

  it('filters affordable rewards in DB path', async () => {
    ;(mockPrisma.reward.count as jest.Mock).mockResolvedValue(1)
    ;(mockPrisma.reward.findMany as jest.Mock).mockResolvedValue([reward])

    await rewardsService.getAll(
      baseQuery({
        availability: 'affordable',
        userBalance: 600,
        sort: 'cost_desc',
      }),
    )
    expect(mockPrisma.reward.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pointsCost: { lte: 600 },
        }),
      }),
    )
  })

  it('in_stock uses in-memory filter and sorting', async () => {
    const rows = [
      { ...reward, id: 'a', quantityRedeemed: 100, quantityTotal: 100 },
      { ...reward, id: 'b', quantityRedeemed: 0, quantityTotal: 10 },
    ]
    ;(mockPrisma.reward.findMany as jest.Mock).mockResolvedValue(rows)

    const out = await rewardsService.getAll(
      baseQuery({ availability: 'in_stock', sort: 'availability' }),
    )
    expect(out.data).toHaveLength(1)
    expect(out.data[0].id).toBe('b')
    expect(out.data.every((r) => r.remaining > 0)).toBe(true)
  })

  it('sort availability orders low-stock before high-stock when both in stock', async () => {
    const rows = [
      {
        ...reward,
        id: 'high',
        pointsCost: 50,
        quantityRedeemed: 0,
        quantityTotal: 100,
      },
      {
        ...reward,
        id: 'low',
        pointsCost: 200,
        quantityRedeemed: 92,
        quantityTotal: 100,
      },
    ]
    ;(mockPrisma.reward.findMany as jest.Mock).mockResolvedValue(rows)

    const out = await rewardsService.getAll(
      baseQuery({ availability: 'in_stock', sort: 'availability' }),
    )
    expect(out.data.map((r) => r.id)).toEqual(['low', 'high'])
  })

  it('low_stock keeps only remaining 1..lowMax', async () => {
    const rows = [
      { ...reward, id: 'a', quantityRedeemed: 95, quantityTotal: 100 },
      { ...reward, id: 'b', quantityRedeemed: 0, quantityTotal: 100 },
    ]
    ;(mockPrisma.reward.findMany as jest.Mock).mockResolvedValue(rows)

    const out = await rewardsService.getAll(
      baseQuery({ availability: 'low_stock', sort: 'cost_asc' }),
    )
    expect(out.data).toHaveLength(1)
    expect(out.data[0].id).toBe('a')
  })

  it('paginates in-memory results', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      ...reward,
      id: `r-${i}`,
      pointsCost: 100 + i,
      quantityRedeemed: 0,
      quantityTotal: 10,
    }))
    ;(mockPrisma.reward.findMany as jest.Mock).mockResolvedValue(rows)

    const out = await rewardsService.getAll(
      baseQuery({
        availability: 'in_stock',
        sort: 'cost_desc',
        page: 2,
        limit: 2,
      }),
    )
    expect(out.total).toBe(5)
    expect(out.data).toHaveLength(2)
    expect(out.totalPages).toBe(3)
  })

  it('returns zero totalPages when nothing matches in-memory', async () => {
    ;(mockPrisma.reward.findMany as jest.Mock).mockResolvedValue([
      { ...reward, quantityRedeemed: 10, quantityTotal: 10 },
    ])
    const out = await rewardsService.getAll(
      baseQuery({ availability: 'in_stock', sort: 'availability' }),
    )
    expect(out.total).toBe(0)
    expect(out.totalPages).toBe(0)
  })

  it('DB path uses cost_asc orderBy', async () => {
    ;(mockPrisma.reward.count as jest.Mock).mockResolvedValue(0)
    ;(mockPrisma.reward.findMany as jest.Mock).mockResolvedValue([])

    await rewardsService.getAll(baseQuery({ sort: 'cost_asc' }))
    expect(mockPrisma.reward.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { pointsCost: 'asc' },
      }),
    )
  })
})

describe('rewardsService.getRedemptionHistory', () => {
  it('returns prisma list', async () => {
    const rows = [{ id: 'x', userId, reward }]
    ;(mockPrisma.redemption.findMany as jest.Mock).mockResolvedValue(rows)
    await expect(rewardsService.getRedemptionHistory(userId)).resolves.toBe(
      rows,
    )
  })
})

describe('rewardsService.createReward', () => {
  it('creates and adds counts', async () => {
    const row = {
      ...reward,
      id: 'new-r',
      quantityRedeemed: 0,
      quantityTotal: 50,
    }
    ;(mockPrisma.reward.create as jest.Mock).mockResolvedValue(row)
    const out = await rewardsService.createReward({
      name: 'Mug',
      pointsCost: 50,
      quantityTotal: 50,
    })
    expect(out.remaining).toBe(50)
    expect(out.claimed).toBe(0)
  })
})

describe('rewardsService.updateReward', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws 404 when reward missing', async () => {
    ;(mockPrisma.reward.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(
      rewardsService.updateReward('missing', { name: 'X' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 400 when quantityTotal below redeemed', async () => {
    ;(mockPrisma.reward.findUnique as jest.Mock).mockResolvedValue({
      ...reward,
      quantityRedeemed: 50,
      quantityTotal: 100,
    })
    await expect(
      rewardsService.updateReward('r1', { quantityTotal: 40 }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('updates when valid', async () => {
    ;(mockPrisma.reward.findUnique as jest.Mock).mockResolvedValue({
      ...reward,
      quantityRedeemed: 5,
      quantityTotal: 100,
    })
    const updated = { ...reward, name: 'Renamed' }
    ;(mockPrisma.reward.update as jest.Mock).mockResolvedValue(updated)
    const out = await rewardsService.updateReward('r1', { name: 'Renamed' })
    expect(out.name).toBe('Renamed')
  })
})
