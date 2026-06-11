import { Router } from 'express'
import { usersController } from './users.controller'
import { authenticate } from '../../middleware/auth.middleware'

export const usersRouter = Router()

usersRouter.use(authenticate)

usersRouter.get('/me/giving-budget', usersController.givingBudget)
usersRouter.get('/me', usersController.me)
usersRouter.get('/', usersController.list)
usersRouter.get('/:id/kudos', usersController.userKudos)
usersRouter.get('/:id', usersController.getById)
