import { Request, Response, NextFunction } from 'express'
import { notificationsService } from './notifications.service'
import { ok } from '../../utils/response'
import { routeParam } from '../../utils/params'

export const notificationsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await notificationsService.list(req.user!.id)
      ok(res, items)
    } catch (err) {
      next(err)
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.markRead(req.user!.id, routeParam(req, 'id'))
      ok(res, null, 'Updated')
    } catch (err) {
      next(err)
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.markAllRead(req.user!.id)
      ok(res, null, 'Updated')
    } catch (err) {
      next(err)
    }
  },
}
