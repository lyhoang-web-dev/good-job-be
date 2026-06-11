import jwt from 'jsonwebtoken'
import { authenticate, authenticateSse } from '@/middleware/auth.middleware'
import type { Request, Response, NextFunction } from 'express'

jest.mock('jsonwebtoken')

function mockReq(cookie?: string, query?: Record<string, unknown>): Request {
  return {
    cookies: cookie ? { access_token: cookie } : {},
    query: query ?? {},
  } as Request
}

function mockRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response
  ;(res.status as jest.Mock).mockReturnValue(res)
  return res
}

describe('authenticate middleware', () => {
  const next = jest.fn() as NextFunction

  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when no cookie', () => {
    const res = mockRes()
    authenticate(mockReq(), res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when token invalid', () => {
    ;(jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('bad')
    })
    const res = mockRes()
    authenticate(mockReq('bad-token'), res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next and sets req.user when token valid', () => {
    const payload = { sub: 'user-1', email: 'a@a.com', role: 'user' }
    ;(jwt.verify as jest.Mock).mockReturnValue(payload)
    const req = mockReq('valid-token')
    const res = mockRes()
    authenticate(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user).toMatchObject({
      id: 'user-1',
      email: 'a@a.com',
      role: 'user',
    })
  })
})

describe('authenticateSse (query token)', () => {
  const next = jest.fn() as NextFunction

  beforeEach(() => jest.clearAllMocks())

  it('accepts access_token from query string', () => {
    const payload = { sub: 'u-sse', email: 's@s.com', role: 'user' }
    ;(jwt.verify as jest.Mock).mockReturnValue(payload)
    const req = mockReq(undefined, { access_token: 'qs-token' })
    const res = mockRes()
    authenticateSse(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user?.id).toBe('u-sse')
  })

  it('accepts access_token as string array (first element)', () => {
    const payload = { sub: 'u2', email: 'b@b.com', role: 'admin' }
    ;(jwt.verify as jest.Mock).mockReturnValue(payload)
    const req = mockReq(undefined, { access_token: ['arr-token'] })
    const res = mockRes()
    authenticateSse(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user?.id).toBe('u2')
  })

  it('returns 401 when query token is empty array first element', () => {
    const req = mockReq(undefined, { access_token: [''] })
    const res = mockRes()
    authenticateSse(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })
})
