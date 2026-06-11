import { Router } from 'express'
import { rewardsController } from './rewards.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { requireRole } from '../../middleware/requireRole.middleware'
import { idempotency } from '../../middleware/idempotency.middleware'

export const rewardsRouter = Router()

rewardsRouter.use(authenticate)

rewardsRouter.get('/', rewardsController.list)
rewardsRouter.post('/redeem', idempotency, rewardsController.redeem)
rewardsRouter.get('/redemptions', rewardsController.history)

rewardsRouter.post('/', requireRole('admin'), rewardsController.create)
rewardsRouter.patch('/:id', requireRole('admin'), rewardsController.update)
