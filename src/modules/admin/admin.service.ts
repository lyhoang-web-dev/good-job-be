import { AuthProvider, Role } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../middleware/errorHandler.middleware'
import { hashPassword } from '../../utils/password'

export const adminService = {
  async listUsers(search?: string) {
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
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  },

  async createUser(data: {
    email: string
    name: string
    password: string
    role?: Role
    balance?: number
  }) {
    const exists = await prisma.user.findUnique({
      where: { email: data.email },
    })
    if (exists) throw new AppError(409, 'Email already registered')

    const hashed = await hashPassword(data.password)
    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashed,
        authProvider: AuthProvider.local,
        role: data.role ?? 'user',
        balance: data.balance ?? 0,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        balance: true,
        createdAt: true,
      },
    })
  },
}
