import { Request, Response, NextFunction } from 'express'
import { Role } from '@prisma/client'

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      res.status(403).json({ message: 'Forbidden' })
      return
    }
    next()
  }
}
