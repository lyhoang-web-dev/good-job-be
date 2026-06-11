import { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      message: err.message,
      code: err.code,
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      message: 'Validation error',
      issues: err.issues,
    })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ message: 'Resource already exists' })
      return
    }
    if (err.code === 'P2003') {
      res.status(400).json({
        message: 'Invalid reference (e.g. user or related record not found)',
      })
      return
    }
  }

  console.error(err)
  res.status(500).json({ message: 'Internal server error' })
}
