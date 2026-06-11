import { Router, Request, Response } from 'express'
import { authenticateSse } from '../../middleware/auth.middleware'
import { pubsubEmitter, ensureSubscribed, releaseSubscriptions } from '../../lib/redis'
import { config } from '../../config'

export const sseRouter = Router()

sseRouter.get('/', authenticateSse, async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const userId = req.user!.id
  const notificationChannel = `notification:${userId}`
  const channels = ['kudo:created', notificationChannel, 'reaction:updated']

  await ensureSubscribed(...channels)

  const send = (event: string, data: unknown, id?: string) => {
    if (id) res.write(`id: ${id}\n`)
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const heartbeat = setInterval(
    () => res.write(': heartbeat\n\n'),
    config.SSE_HEARTBEAT_INTERVAL_MS,
  )

  const onKudo = (message: string) => send('kudo_created', JSON.parse(message), Date.now().toString())
  const onNotification = (message: string) => send('notification', JSON.parse(message), Date.now().toString())
  const onReaction = (message: string) => send('reaction_updated', JSON.parse(message), Date.now().toString())

  pubsubEmitter.on('kudo:created', onKudo)
  pubsubEmitter.on(notificationChannel, onNotification)
  pubsubEmitter.on('reaction:updated', onReaction)

  req.on('close', () => {
    clearInterval(heartbeat)
    pubsubEmitter.off('kudo:created', onKudo)
    pubsubEmitter.off(notificationChannel, onNotification)
    pubsubEmitter.off('reaction:updated', onReaction)
    void releaseSubscriptions(...channels)
  })
})
