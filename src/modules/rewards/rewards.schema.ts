import type { Request } from 'express'
import { z } from 'zod'

export const rewardQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  availability: z
    .enum(['all', 'in_stock', 'low_stock', 'affordable'])
    .default('all'),
  sort: z
    .enum(['availability', 'cost_asc', 'cost_desc'])
    .default('availability'),
  userBalance: z.coerce.number().int().min(0).optional(),

  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
})

export type RewardQuery = z.infer<typeof rewardQuerySchema>

function firstQueryString(val: unknown): string | undefined {
  if (typeof val === 'string') {
    const t = val.trim()
    return t.length ? t : undefined
  }
  if (Array.isArray(val) && typeof val[0] === 'string') {
    const t = val[0].trim()
    return t.length ? t : undefined
  }
  return undefined
}

export function parseRewardQuery(req: Request): RewardQuery {
  return rewardQuerySchema.parse({
    search: firstQueryString(req.query.search),
    availability: firstQueryString(req.query.availability),
    sort: firstQueryString(req.query.sort),
    userBalance: firstQueryString(req.query.userBalance),
    page: firstQueryString(req.query.page),
    limit: firstQueryString(req.query.limit),
  })
}
