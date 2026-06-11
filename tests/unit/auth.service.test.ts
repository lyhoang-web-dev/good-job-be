import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import type { Response } from 'express'
import { signAccessToken } from '@/utils/jwt'
import { authService } from '@/modules/auth/auth.service'
import { prisma } from '@/lib/prisma'
import { mockUser } from '../helpers/fixtures'

jest.mock('@/utils/jwt', () => ({
  signAccessToken: jest.fn().mockReturnValue('jwt-from-mock'),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('authService.login', () => {
  beforeEach(() => jest.clearAllMocks())

  it('throws 401 when user not found', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(authService.login('x@x.com', 'pass')).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('throws 401 when password wrong', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
    await expect(authService.login(mockUser.email, 'wrong')).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('throws 400 when SSO user tries password login', async () => {
    const ssoUser = { ...mockUser, authProvider: 'google', password: null }
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(ssoUser)
    await expect(authService.login(mockUser.email, 'pass')).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 401 when account inactive', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...mockUser,
      isActive: false,
    })
    await expect(authService.login(mockUser.email, 'pass')).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('returns token and safe user on success', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
    const result = await authService.login(mockUser.email, 'password123')
    expect(result.token).toBe('jwt-from-mock')
    expect((result.user as { password?: string }).password).toBeUndefined()
    expect(signAccessToken).toHaveBeenCalled()
  })
})

describe('authService.register', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates user when email is new', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed')
    const created = {
      id: 'new',
      email: 'new@x.com',
      name: 'New',
      role: 'user',
      balance: 0,
      createdAt: new Date(),
    }
    ;(mockPrisma.user.create as jest.Mock).mockResolvedValue(created)

    const result = await authService.register(
      'new@x.com',
      'New',
      'password123',
    )
    expect(result).toEqual(created)
    expect(mockPrisma.user.create).toHaveBeenCalled()
  })

  it('throws 409 when email exists (local)', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    await expect(
      authService.register(mockUser.email, 'N', 'password123'),
    ).rejects.toMatchObject({ statusCode: 409, message: 'Email already registered' })
  })

  it('throws 409 when email exists (Google)', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...mockUser,
      authProvider: 'google',
    })
    await expect(
      authService.register(mockUser.email, 'N', 'password123'),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('Google'),
    })
  })

  it('maps Prisma P2002 to 409', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed')
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    })
    ;(mockPrisma.user.create as jest.Mock).mockRejectedValue(p2002)
    await expect(
      authService.register('x@x.com', 'X', 'password123'),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rethrows unexpected errors from create', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed')
    ;(mockPrisma.user.create as jest.Mock).mockRejectedValue(new Error('db down'))
    await expect(
      authService.register('x@x.com', 'X', 'password123'),
    ).rejects.toThrow('db down')
  })
})

describe('authService.signToken & setCookie', () => {
  beforeEach(() => jest.clearAllMocks())

  it('signToken delegates to signAccessToken', () => {
    const t = authService.signToken('uid', 'e@e.com', 'admin')
    expect(t).toBe('jwt-from-mock')
    expect(signAccessToken).toHaveBeenCalledWith({
      sub: 'uid',
      email: 'e@e.com',
      role: 'admin',
    })
  })

  it('setCookie writes access_token', () => {
    const res = { cookie: jest.fn() } as unknown as Response
    authService.setCookie(res, 'tok')
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'tok',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
      }),
    )
  })
})
