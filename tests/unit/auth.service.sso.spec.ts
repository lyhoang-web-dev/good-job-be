import { authService } from '@/modules/auth/auth.service'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const googleDto = {
  googleId: 'google-sub-123',
  email: 'alice@gmail.com',
  name: 'Alice Nguyen',
  avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
}

describe('authService.findOrCreateGoogleUser', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns existing user if googleId found', async () => {
    const existing = {
      id: 'u1',
      email: googleDto.email,
      name: googleDto.name,
      googleId: googleDto.googleId,
      isActive: true,
    }
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(existing)

    const result = await authService.findOrCreateGoogleUser(googleDto)

    expect(result).toEqual(existing)
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('links Google to existing email/password account', async () => {
    const existingLocal = {
      id: 'u2',
      email: googleDto.email,
      googleId: null,
      avatarUrl: null,
      isActive: true,
    }
    const linked = { ...existingLocal, googleId: googleDto.googleId }

    ;(mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingLocal)
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue(linked)

    const result = await authService.findOrCreateGoogleUser(googleDto)

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u2' },
        data: expect.objectContaining({ googleId: googleDto.googleId }),
      }),
    )
    expect(result.googleId).toBe(googleDto.googleId)
  })

  it('links Google keeping existing avatar when dto omits avatarUrl', async () => {
    const dtoNoPhoto = {
      googleId: 'google-sub-999',
      email: 'merge@example.com',
      name: 'Merge User',
    }
    const existingLocal = {
      id: 'u9',
      email: dtoNoPhoto.email,
      googleId: null,
      avatarUrl: 'https://cdn.example/old.png',
      isActive: true,
    }
    ;(mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingLocal)
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({
      ...existingLocal,
      googleId: dtoNoPhoto.googleId,
    })

    await authService.findOrCreateGoogleUser(dtoNoPhoto)

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          avatarUrl: 'https://cdn.example/old.png',
        }),
      }),
    )
  })

  it('creates new user if email not found', async () => {
    const newUser = {
      id: 'u3',
      email: googleDto.email,
      name: googleDto.name,
      googleId: googleDto.googleId,
      authProvider: 'google',
      password: null,
    }

    ;(mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    ;(mockPrisma.user.create as jest.Mock).mockResolvedValue(newUser)

    const result = await authService.findOrCreateGoogleUser(googleDto)

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: googleDto.email,
          googleId: googleDto.googleId,
          authProvider: 'google',
          name: googleDto.name,
          balance: 0,
          role: 'user',
        }),
      }),
    )
    expect(result.id).toBe('u3')
  })

  it('throws 403 when found account by googleId is inactive', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'u1',
      isActive: false,
      googleId: googleDto.googleId,
    })
    await expect(authService.findOrCreateGoogleUser(googleDto)).rejects.toMatchObject({
      statusCode: 403,
    })
  })
})
