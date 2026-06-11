import { Router, type RequestHandler } from 'express'
import { passport, googleConfigured } from '../../lib/passport'
import { authController } from './auth.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { authRateLimiter } from '../../middleware/rateLimiter.middleware'

export const authRouter = Router()

const requireGoogleOAuth: RequestHandler = (_req, res, next) => {
  if (!googleConfigured) {
    res.status(503).json({ message: 'Google OAuth is not configured' })
    return
  }
  next()
}

authRouter.post('/login', authRateLimiter, authController.login)
authRouter.post('/logout', authController.logout)
authRouter.get('/me', authenticate, authController.me)

authRouter.get(
  '/google',
  requireGoogleOAuth,
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  }),
)

authRouter.get(
  '/google/callback',
  requireGoogleOAuth,
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/auth/google/failure',
  }),
  authController.googleCallback,
)

authRouter.get('/google/failure', authController.googleFailure)
