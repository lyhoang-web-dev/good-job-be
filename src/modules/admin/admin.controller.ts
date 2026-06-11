import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { adminService } from './admin.service'
import { created, ok } from '../../utils/response'

const roles: [Role, ...Role[]] = ['user', 'admin']

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(roles).optional(),
  balance: z.number().int().min(0).optional(),
})

export const adminController = {
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const search =
        typeof req.query.search === 'string' ? req.query.search : undefined
      const users = await adminService.listUsers(search)
      ok(res, users)
    } catch (err) {
      next(err)
    }
  },

  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createUserSchema.parse(req.body)
      const user = await adminService.createUser(body)
      created(res, user)
    } catch (err) {
      next(err)
    }
  },
}
