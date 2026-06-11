import { Router } from 'express'
import { notificationsController } from './notifications.controller'
import { authenticate } from '../../middleware/auth.middleware'

export const notificationsRouter = Router()

notificationsRouter.use(authenticate)

notificationsRouter.get('/', notificationsController.list)
notificationsRouter.patch('/read-all', notificationsController.markAllRead)
notificationsRouter.patch('/:id/read', notificationsController.markRead)
