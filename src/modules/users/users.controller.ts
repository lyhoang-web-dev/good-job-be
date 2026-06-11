import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppError } from '../../middleware/errorHandler.middleware'
import { prisma } from '../../lib/prisma'
import { usersService } from './users.service'
import { ok } from '../../utils/response'
import { routeParam } from '../../utils/params'

const kudosDirectionSchema = z.enum(['sent', 'received'])

export const usersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const search =
        typeof req.query.search === 'string' ? req.query.search : undefined
      const users = await usersService.list(search)
      ok(res, users)
    } catch (err) {
      next(err)
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.user!.id },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          balance: true,
          isActive: true,
          authProvider: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      ok(res, user)
    } catch (err) {
      next(err)
    }
  },

  async givingBudget(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await usersService.getGivingBudget(req.user!.id)
      ok(res, data)
    } catch (err) {
      next(err)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.getById(routeParam(req, 'id'))
      ok(res, user)
    } catch (err) {
      next(err)
    }
  },

  async userKudos(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = kudosDirectionSchema.safeParse(req.query.direction)
      if (!parsed.success) {
        throw new AppError(400, 'Query direction must be sent or received')
      }
      const direction = parsed.data
      const data = await usersService.getUserKudos(
        req.user!.id,
        req.user!.role,
        routeParam(req, 'id'),
        direction,
      )
      ok(res, data)
    } catch (err) {
      next(err)
    }
  },
}
