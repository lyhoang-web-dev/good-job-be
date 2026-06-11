import { Request, Response, NextFunction } from 'express'
import { config } from '../config'
import { redis } from '../lib/redis'

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function idempotency(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const key = req.headers['x-idempotency-key'] as string | undefined
  if (!key || !['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next()
  }

  const cacheKey = `idempotency:result:${key}`
  const lockKey = `idempotency:lock:${key}`

  const cached = await redis.get(cacheKey)
  if (cached) {
    const { status, body } = JSON.parse(cached) as {
      status: number
      body: unknown
    }
    res.status(status).json(body)
    return
  }

  const acquired = await redis.set(
    lockKey,
    '1',
    'EX',
    config.IDEMPOTENCY_LOCK_TTL_SEC,
    'NX',
  )

  if (!acquired) {
    for (let i = 0; i < config.IDEMPOTENCY_LOCK_POLL_ATTEMPTS; i++) {
      await sleep(config.IDEMPOTENCY_LOCK_POLL_MS)
      const retry = await redis.get(cacheKey)
      if (retry) {
        const { status, body } = JSON.parse(retry) as {
          status: number
          body: unknown
        }
        res.status(status).json(body)
        return
      }
    }
    res.setHeader('Retry-After', String(Math.ceil(config.IDEMPOTENCY_LOCK_POLL_MS / 1000)))
    res.status(503).json({
      message: 'Request in progress, please retry shortly',
    })
    return
  }

  let lockReleased = false
  const releaseLock = () => {
    if (lockReleased) return
    lockReleased = true
    void redis.del(lockKey)
  }
  res.once('finish', releaseLock)
  res.once('close', releaseLock)

  const originalJson = res.json.bind(res)
  res.json = (body: unknown) => {
    if (res.statusCode < 400) {
      void redis.setex(
        cacheKey,
        config.IDEMPOTENCY_CACHE_TTL_SEC,
        JSON.stringify({ status: res.statusCode, body }),
      )
    }
    return originalJson(body)
  }

  next()
}
