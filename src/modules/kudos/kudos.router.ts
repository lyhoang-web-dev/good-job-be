import { Router } from 'express'
import { kudosController } from './kudos.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { idempotency } from '../../middleware/idempotency.middleware'

export const kudosRouter = Router()

kudosRouter.use(authenticate)

kudosRouter.get('/', kudosController.list)
kudosRouter.post('/', idempotency, kudosController.create)
kudosRouter.post('/:id/reactions', kudosController.addReaction)
kudosRouter.delete('/:id/reactions/:emoji', kudosController.removeReaction)
kudosRouter.get('/:id/comments', kudosController.getComments)
kudosRouter.post('/:id/comments', kudosController.addComment)
