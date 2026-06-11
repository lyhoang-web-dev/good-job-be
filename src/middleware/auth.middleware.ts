import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'
import { config } from '../config'


interface JwtPayload {
 sub: string
 email: string
 role: string
}


function parseQueryToken(req: Request): string | undefined {
 const raw = req.query.access_token
 if (typeof raw === 'string' && raw.length > 0) return raw
 if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].length > 0) {
   return raw[0]
 }
 return undefined
}


function attachUser(req: Request, token: string) {
 const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload
 req.user = {
   id: payload.sub,
   email: payload.email,
   role: payload.role as Role,
 }
}


function createAuthMiddleware(allowQueryToken: boolean) {
 return function (req: Request, res: Response, next: NextFunction) {
   const token =
     req?.headers?.authorization?.split('Bearer ')[1] ??
     (allowQueryToken ? parseQueryToken(req) : undefined)
   if (!token) {
     res.status(401).json({ message: 'Unauthorized' })
     return
   }
   try {
     attachUser(req, token)
     next()
   } catch {
     res.status(401).json({ message: 'Invalid or expired token' })
   }
 }
}


export const authenticate = createAuthMiddleware(false)
export const authenticateSse = createAuthMiddleware(true)