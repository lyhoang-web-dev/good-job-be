import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { CoreValue } from '@prisma/client'
import { kudosService } from './kudos.service'
import { created, ok } from '../../utils/response'
import { routeParam } from '../../utils/params'

const coreValues: [CoreValue, ...CoreValue[]] = [
  'teamwork',
  'ownership',
  'innovation',
  'integrity',
  'customer_focus',
]

const createSchema = z.object({
  receiverId: z.string().uuid(),
  points: z.number().int().min(10).max(50),
  message: z.string().min(10),
  coreValue: z.enum(coreValues),
})

const commentSchema = z.object({
  content: z.string().min(1),
})

export const kudosController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const cursor =
        typeof req.query.cursor === 'string' ? req.query.cursor : undefined
      const limit = req.query.limit
        ? Math.min(50, Math.max(1, Number(req.query.limit)))
        : 20
      const result = await kudosService.getKudos(cursor, limit)
      ok(res, result)
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = createSchema.parse(req.body)
      const kudo = await kudosService.createKudo(req.user!.id, dto)
      created(res, kudo)
    } catch (err) {
      next(err)
    }
  },

  async addReaction(req: Request, res: Response, next: NextFunction) {
    try {
      const { emoji } = z.object({ emoji: z.string().min(1) }).parse(req.body)
      const reaction = await kudosService.addReaction(
        routeParam(req, 'id'),
        req.user!.id,
        emoji,
      )
      created(res, reaction)
    } catch (err) {
      next(err)
    }
  },

  async removeReaction(req: Request, res: Response, next: NextFunction) {
    try {
      const emoji = decodeURIComponent(routeParam(req, 'emoji'))
      await kudosService.removeReaction(
        routeParam(req, 'id'),
        req.user!.id,
        emoji,
      )
      ok(res, null, 'Reaction removed')
    } catch (err) {
      next(err)
    }
  },

  async getComments(req: Request, res: Response, next: NextFunction) {
    try {
      const comments = await kudosService.getComments(routeParam(req, 'id'))
      ok(res, comments)
    } catch (err) {
      next(err)
    }
  },

  async addComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { content } = commentSchema.parse(req.body)
      const comment = await kudosService.addComment(
        routeParam(req, 'id'),
        req.user!.id,
        content,
      )
      created(res, comment)
    } catch (err) {
      next(err)
    }
  },
}
