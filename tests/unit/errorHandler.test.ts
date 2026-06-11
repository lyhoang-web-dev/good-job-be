import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { errorHandler, AppError } from '@/middleware/errorHandler.middleware'
import type { Request, Response, NextFunction } from 'express'

function mockRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response
  ;(res.status as jest.Mock).mockReturnValue(res)
  return res
}

describe('errorHandler', () => {
  const req = {} as Request
  const next = jest.fn() as NextFunction

  it('returns correct status for AppError', () => {
    const res = mockRes()
    errorHandler(new AppError(400, 'Bad input'), req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Bad input' }),
    )
  })

  it('returns 400 for ZodError', () => {
    const res = mockRes()
    const parsed = z.string().uuid().safeParse('not-a-uuid')
    if (parsed.success) throw new Error('expected parse failure')
    errorHandler(parsed.error, req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Validation error' }),
    )
  })

  it('returns 409 for Prisma P2002', () => {
    const res = mockRes()
    const err = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    })
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('returns 400 for Prisma P2003', () => {
    const res = mockRes()
    const err = new Prisma.PrismaClientKnownRequestError('fk', {
      code: 'P2003',
      clientVersion: 'test',
    })
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Invalid reference'),
      }),
    )
  })

  it('returns 500 for unknown errors', () => {
    const res = mockRes()
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    errorHandler(new Error('Unknown'), req, res, next)
    expect(res.status).toHaveBeenCalledWith(500)
    spy.mockRestore()
  })

  it('returns 500 for Prisma errors other than P2002/P2003', () => {
    const res = mockRes()
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Prisma.PrismaClientKnownRequestError('other', {
      code: 'P2025',
      clientVersion: 'test',
    })
    errorHandler(err, req, res, next)
    expect(res.status).toHaveBeenCalledWith(500)
    spy.mockRestore()
  })
})
