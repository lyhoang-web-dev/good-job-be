import jwt, { type SignOptions } from 'jsonwebtoken'
import { config } from '../config'
import type { Role } from '@prisma/client'

export interface AccessTokenPayload {
  sub: string
  email: string
  role: Role
}

const signOptions: SignOptions = {
  expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn'],
}

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(
    { sub: payload.sub, email: payload.email, role: payload.role },
    config.JWT_SECRET,
    signOptions,
  )
}
