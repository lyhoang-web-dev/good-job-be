import { kudosService } from '@/modules/kudos/kudos.service'
import { prisma } from '@/lib/prisma'
import * as redisLib from '@/lib/redis'
import { AppError } from '@/middleware/errorHandler.middleware'
import { mockUser, mockUserB, mockKudo } from '../helpers/fixtures'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
    kudo: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    pointLedger: { create: jest.fn() },
    notification: { create: jest.fn() },
    reaction: { create: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    comment: { create: jest.fn(), findMany: jest.fn() },
  },
}))

jest.mock('@/lib/redis', () => ({
  publishEvent: jest.fn(),
}))

const mockPrisma = prisma as unknown as jest.Mocked<typeof prisma>

function mockReceiverExists(receiverId: string) {
  ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: receiverId })
}

describe('kudosService.createKudo', () => {
  const senderId = 'user-a'
  const base = {
    receiverId: 'user-b',
    points: 30,
    message: 'Great work on the sprint demo!',
    coreValue: 'teamwork' as const,
  }

  beforeEach(() => jest.clearAllMocks())

  it('throws 400 when sender equals receiver', async () => {
    await expect(
      kudosService.createKudo(senderId, { ...base, receiverId: senderId }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 404 when receiver does not exist', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(kudosService.createKudo(senderId, base)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Receiver not found',
    })
  })

  it('throws 400 when budget guard returns 0 affected rows', async () => {
    mockReceiverExists(base.receiverId)
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        mockPrisma.$executeRaw
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0)
        return fn(mockPrisma)
      },
    )

    await expect(kudosService.createKudo(senderId, base)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('budget'),
    })
  })

  it('creates kudo, increments receiver balance, and inserts ledger on success', async () => {
    mockReceiverExists(base.receiverId)
    const fakeKudo = {
      ...mockKudo,
      senderId,
      receiverId: base.receiverId,
      sender: {
        id: mockUser.id,
        name: mockUser.name,
        avatarUrl: mockUser.avatarUrl,
      },
      receiver: {
        id: mockUserB.id,
        name: mockUserB.name,
        avatarUrl: mockUserB.avatarUrl,
      },
      media: [],
      reactions: [],
      _count: { comments: 0 },
    }

    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        mockPrisma.$executeRaw.mockResolvedValue(1)
        ;(mockPrisma.kudo.create as jest.Mock).mockResolvedValue(fakeKudo)
        ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({ balance: 130 })
        ;(mockPrisma.pointLedger.create as jest.Mock).mockResolvedValue({})
        return fn(mockPrisma)
      },
    )
    ;(mockPrisma.notification.create as jest.Mock).mockResolvedValue({})

    const result = await kudosService.createKudo(senderId, base)

    expect(result.id).toBe('kudo-1')
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: base.receiverId },
        data: { balance: { increment: base.points } },
      }),
    )
    expect(mockPrisma.pointLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 30,
          balanceAfter: 130,
          type: 'received',
        }),
      }),
    )
    expect(redisLib.publishEvent).toHaveBeenCalledWith(
      'kudo:created',
      expect.anything(),
    )
    expect(redisLib.publishEvent).toHaveBeenCalledWith(
      `notification:${base.receiverId}`,
      expect.anything(),
    )
  })

  it('allows sending exactly remaining budget (boundary)', async () => {
    mockReceiverExists(base.receiverId)
    const fakeKudo = {
      ...mockKudo,
      senderId,
      sender: { id: mockUser.id, name: mockUser.name, avatarUrl: null },
      receiver: { id: mockUserB.id, name: mockUserB.name, avatarUrl: null },
      media: [],
      reactions: [],
      _count: { comments: 0 },
    }
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        mockPrisma.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(1)
        ;(mockPrisma.kudo.create as jest.Mock).mockResolvedValue(fakeKudo)
        ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({ balance: 30 })
        ;(mockPrisma.pointLedger.create as jest.Mock).mockResolvedValue({})
        return fn(mockPrisma)
      },
    )
    ;(mockPrisma.notification.create as jest.Mock).mockResolvedValue({})

    await expect(kudosService.createKudo(senderId, base)).resolves.toBeDefined()
  })
})

describe('kudosService.createKudo points (service accepts Zod-validated input)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReceiverExists('user-b')
    ;(mockPrisma.notification.create as jest.Mock).mockResolvedValue({})
  })

  it.each([10, 25, 50])('accepts %i points from controller-validated DTO', async (pts) => {
    const fakeKudo = {
      id: 'k',
      senderId: 'user-a',
      receiverId: 'user-b',
      points: pts,
      message: 'Long enough message here',
      coreValue: 'teamwork' as const,
      status: 'active' as const,
      sender: { id: 'a', name: 'S', avatarUrl: null },
      receiver: { id: 'b', name: 'R', avatarUrl: null },
      media: [],
      reactions: [],
      _count: { comments: 0 },
    }
    ;(mockPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        mockPrisma.$executeRaw.mockResolvedValue(1)
        ;(mockPrisma.kudo.create as jest.Mock).mockResolvedValue(fakeKudo)
        ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({ balance: pts })
        ;(mockPrisma.pointLedger.create as jest.Mock).mockResolvedValue({})
        return fn(mockPrisma)
      },
    )

    await expect(
      kudosService.createKudo('user-a', {
        receiverId: 'user-b',
        points: pts,
        message: 'Long enough message here',
        coreValue: 'teamwork',
      }),
    ).resolves.toBeDefined()
  })
})

describe('kudosService.getKudos', () => {
  beforeEach(() => jest.clearAllMocks())

  it('defaults limit to 20 when second argument omitted', async () => {
    ;(mockPrisma.kudo.findMany as jest.Mock).mockResolvedValue([])
    await kudosService.getKudos(undefined)
    expect(mockPrisma.kudo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 21 }),
    )
  })

  it('uses cursor skip when cursor is provided', async () => {
    const items = [
      {
        ...mockKudo,
        id: 'k2',
        sender: mockUser,
        receiver: mockUserB,
        media: [],
        reactions: [],
        _count: { comments: 1 },
      },
    ]
    ;(mockPrisma.kudo.findMany as jest.Mock).mockResolvedValue(items)

    const result = await kudosService.getKudos('k1', 20)
    expect(mockPrisma.kudo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'k1' },
        skip: 1,
      }),
    )
    expect(result.data[0].commentsCount).toBe(1)
  })

  it('returns paginated data with nextCursor when more items exist', async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      ...mockKudo,
      id: `kudo-${i}`,
      sender: mockUser,
      receiver: mockUserB,
      media: [],
      reactions: [],
      _count: { comments: 0 },
    }))
    ;(mockPrisma.kudo.findMany as jest.Mock).mockResolvedValue(items)

    const result = await kudosService.getKudos(undefined, 20)
    expect(result.data).toHaveLength(20)
    expect(result.nextCursor).toBeDefined()
  })

  it('returns no nextCursor on last page', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      ...mockKudo,
      id: `kudo-${i}`,
      sender: mockUser,
      receiver: mockUserB,
      media: [],
      reactions: [],
      _count: { comments: 0 },
    }))
    ;(mockPrisma.kudo.findMany as jest.Mock).mockResolvedValue(items)

    const result = await kudosService.getKudos(undefined, 20)
    expect(result.data).toHaveLength(5)
    expect(result.nextCursor).toBeUndefined()
  })
})

describe('kudosService reactions & comments', () => {
  beforeEach(() => jest.clearAllMocks())

  it('addReaction throws for invalid emoji', async () => {
    await expect(
      kudosService.addReaction('k1', 'u1', '🚫'),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('addReaction creates and publishes', async () => {
    const reaction = { id: 'r1', kudoId: 'k1', userId: 'u1', emoji: '👏' }
    ;(mockPrisma.reaction.create as jest.Mock).mockResolvedValue(reaction)
    ;(mockPrisma.reaction.findMany as jest.Mock).mockResolvedValue([])

    const out = await kudosService.addReaction('k1', 'u1', '👏')
    expect(out).toEqual(reaction)
    expect(redisLib.publishEvent).toHaveBeenCalledWith(
      'reaction:updated',
      expect.objectContaining({ kudoId: 'k1' }),
    )
  })

  it('removeReaction throws when kudo missing', async () => {
    ;(mockPrisma.kudo.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(
      kudosService.removeReaction('missing', 'u1', '👏'),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('removeReaction deletes and publishes', async () => {
    ;(mockPrisma.kudo.findUnique as jest.Mock).mockResolvedValue({ id: 'k1' })
    ;(mockPrisma.reaction.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.reaction.findMany as jest.Mock).mockResolvedValue([])

    await kudosService.removeReaction('k1', 'u1', '👏')
    expect(mockPrisma.reaction.deleteMany).toHaveBeenCalled()
    expect(redisLib.publishEvent).toHaveBeenCalled()
  })

  it('getComments delegates to prisma', async () => {
    const rows = [{ id: 'c1', content: 'Hi' }]
    ;(mockPrisma.comment.findMany as jest.Mock).mockResolvedValue(rows)
    await expect(kudosService.getComments('k1')).resolves.toEqual(rows)
  })

  it('addComment throws when empty', async () => {
    await expect(
      kudosService.addComment('k1', 'u1', '   '),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('addComment creates', async () => {
    const row = { id: 'c1', content: 'Nice work' }
    ;(mockPrisma.comment.create as jest.Mock).mockResolvedValue(row)
    await expect(
      kudosService.addComment('k1', 'u1', 'Nice work'),
    ).resolves.toEqual(row)
  })
})
