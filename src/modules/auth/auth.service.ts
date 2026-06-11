import bcrypt from 'bcryptjs'
import type { Response } from 'express'
import { AuthProvider, Prisma, Role, type User } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../middleware/errorHandler.middleware'
import { signAccessToken } from '../../utils/jwt'
import { config } from '../../config'


export interface GoogleUserDto {
 googleId: string
 email: string
 name: string
 avatarUrl?: string
}


export const authService = {
 async login(email: string, password: string) {
   const user = await prisma.user.findUnique({ where: { email } })


   if (!user || !user.isActive) {
     throw new AppError(401, 'Invalid email or password')
   }


   if (user.authProvider !== AuthProvider.local || !user.password) {
     throw new AppError(
       400,
       'This account uses Google Sign-In. Please login with Google.',
     )
   }


   if (!(await bcrypt.compare(password, user.password))) {
     throw new AppError(401, 'Invalid email or password')
   }


   const token = signAccessToken({
     sub: user.id,
     email: user.email,
     role: user.role,
   })


   const { password: _, ...safeUser } = user
   return { token, user: safeUser }
 },


 async register(email: string, name: string, password: string) {
   const exists = await prisma.user.findUnique({ where: { email } })


   if (exists) {
     if (exists.authProvider === AuthProvider.google) {
       throw new AppError(
         409,
         'This email is registered via Google. Please sign in with Google.',
       )
     }
     throw new AppError(409, 'Email already registered')
   }


   const hashed = await bcrypt.hash(password, 10)
   try {
     return await prisma.user.create({
       data: {
         email,
         name,
         password: hashed,
         authProvider: AuthProvider.local,
       },
       select: {
         id: true,
         email: true,
         name: true,
         role: true,
         balance: true,
         createdAt: true,
       },
     })
   } catch (err) {
     if (
       err instanceof Prisma.PrismaClientKnownRequestError &&
       err.code === 'P2002'
     ) {
       throw new AppError(409, 'Email already registered')
     }
     throw err
   }
 },


 async findOrCreateGoogleUser(dto: GoogleUserDto): Promise<User> {
   let user = await prisma.user.findUnique({
     where: { googleId: dto.googleId },
   })


   if (user) {
     if (!user.isActive) throw new AppError(403, 'Account is disabled')
     return user
   }


   user = await prisma.user.findUnique({
     where: { email: dto.email },
   })


   if (user) {
     if (!user.isActive) throw new AppError(403, 'Account is disabled')


     return prisma.user.update({
       where: { id: user.id },
       data: {
         googleId: dto.googleId,
         authProvider: AuthProvider.google,
         avatarUrl: dto.avatarUrl ?? user.avatarUrl,
       },
     })
   }


   return prisma.user.create({
     data: {
       email: dto.email,
       name: dto.name,
       avatarUrl: dto.avatarUrl,
       googleId: dto.googleId,
       authProvider: AuthProvider.google,
       role: Role.user,
       balance: 0,
     },
   })
 },


 signToken(userId: string, email: string, role: string) {
   return signAccessToken({
     sub: userId,
     email,
     role: role as User['role'],
   })
 },
}
