import { Router } from 'express'
import { adminController } from './admin.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { requireRole } from '../../middleware/requireRole.middleware'

export const adminRouter = Router()

adminRouter.use(authenticate)
adminRouter.use(requireRole('admin'))

adminRouter.get('/users', adminController.listUsers)
adminRouter.post('/users', adminController.createUser)
