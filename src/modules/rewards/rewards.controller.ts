import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { rewardsService } from './rewards.service'
import { parseRewardQuery } from './rewards.schema'
import { AppError } from '../../middleware/errorHandler.middleware'
import { created, ok } from '../../utils/response'
import { routeParam } from '../../utils/params'

const redeemSchema = z.object({
  rewardId: z.string().uuid(),
})

const createRewardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  pointsCost: z.number().int().positive(),
  quantityTotal: z.number().int().min(1).max(10_000_000),
  imageUrl: z.string().optional().nullable(),
})

const updateRewardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  pointsCost: z.number().int().positive().optional(),
  imageUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  quantityTotal: z.number().int().min(1).max(10_000_000).optional(),
})

export const rewardsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const rewards = await rewardsService.getAll(parseRewardQuery(req))
      ok(res, rewards)
    } catch (err) {
      next(err)
    }
  },

  async redeem(req: Request, res: Response, next: NextFunction) {
    try {
      const idempotencyKey = req.headers['x-idempotency-key']
      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        throw new AppError(400, 'X-Idempotency-Key header is required')
      }
      const { rewardId } = redeemSchema.parse(req.body)
      const redemption = await rewardsService.redeem(req.user!.id, {
        rewardId,
        idempotencyKey,
      })
      created(res, redemption)
    } catch (err) {
      next(err)
    }
  },

  async history(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await rewardsService.getRedemptionHistory(req.user!.id)
      ok(res, rows)
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createRewardSchema.parse(req.body)
      const reward = await rewardsService.createReward(data)
      created(res, reward)
    } catch (err) {
      next(err)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateRewardSchema.parse(req.body)
      const reward = await rewardsService.updateReward(routeParam(req, 'id'), data)
      ok(res, reward)
    } catch (err) {
      next(err)
    }
  },
}
