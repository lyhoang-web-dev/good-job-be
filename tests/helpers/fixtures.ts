import type { User, Kudo, Reward, GivingBudget } from '@prisma/client'
import { AuthProvider, Role } from '@prisma/client'

export const mockUser: User = {
  id: 'user-1',
  email: 'alice@goodjob.com',
  name: 'Alice Nguyen',
  avatarUrl: null,
  password: '$2a$10$hashedpassword',
  googleId: null,
  authProvider: AuthProvider.local,
  role: Role.user,
  balance: 350,
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

export const mockUserB: User = {
  ...mockUser,
  id: 'user-2',
  name: 'Bob Tran',
  email: 'bob@goodjob.com',
  balance: 100,
}

export const mockKudo: Kudo = {
  id: 'kudo-1',
  senderId: 'user-1',
  receiverId: 'user-2',
  points: 30,
  message: 'Great work on the sprint demo!',
  coreValue: 'teamwork',
  status: 'active',
  createdAt: new Date('2025-04-10'),
  updatedAt: new Date('2025-04-10'),
}

export const mockReward: Reward = {
  id: 'reward-1',
  name: 'Company Hoodie',
  description: 'Official hoodie',
  pointsCost: 500,
  imageUrl: null,
  isActive: true,
  quantityTotal: 100,
  quantityRedeemed: 10,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

export const mockBudget: GivingBudget = {
  id: 'budget-1',
  userId: 'user-1',
  yearMonth: '2025-04',
  usedPoints: 50,
  updatedAt: new Date(),
}
