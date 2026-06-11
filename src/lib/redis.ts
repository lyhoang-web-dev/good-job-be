import type { RedisOptions } from 'ioredis'
import Redis from 'ioredis'
import { EventEmitter } from 'events'
import { config } from '../config'

function buildRedisConnectionOptions(): RedisOptions {
  const urlStr = process.env.REDIS_URL?.trim()
  if (urlStr) {
    let parsed: URL
    try {
      parsed = new URL(urlStr)
    } catch {
      throw new Error('REDIS_URL is not a valid URL')
    }
    const opts: RedisOptions = {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
    }
    if (parsed.password !== '') {
      opts.password = decodeURIComponent(parsed.password)
    }
    if (parsed.username !== '') {
      opts.username = decodeURIComponent(parsed.username)
    }
    if (parsed.protocol === 'rediss:') {
      opts.tls = {}
    }
    return opts
  }
  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
  }
}

export const redisConnection: RedisOptions = buildRedisConnectionOptions()

const clientOptions: RedisOptions = { ...redisConnection, lazyConnect: true }

export const redis = new Redis(clientOptions)
redis.on('error', (err) => console.error('[redis] error:', err.message))

const _subscriber = new Redis(clientOptions)
_subscriber.on('error', (err) =>
  console.error('[redis:sub] error:', err.message),
)

export const pubsubEmitter = new EventEmitter()
pubsubEmitter.setMaxListeners(0)

const subscribedChannels = new Set<string>()
const channelRefCounts = new Map<string, number>()

_subscriber.on('message', (channel, message) => {
  pubsubEmitter.emit(channel, message)
})

export async function ensureSubscribed(...channels: string[]) {
  const toAdd = channels.filter((c) => !subscribedChannels.has(c))
  if (toAdd.length > 0) {
    toAdd.forEach((c) => subscribedChannels.add(c))
    await _subscriber.subscribe(...toAdd)
  }
  channels.forEach((c) =>
    channelRefCounts.set(c, (channelRefCounts.get(c) ?? 0) + 1),
  )
}

export async function releaseSubscriptions(...channels: string[]) {
  const toRemove: string[] = []
  for (const c of channels) {
    const count = (channelRefCounts.get(c) ?? 1) - 1
    if (count <= 0) {
      channelRefCounts.delete(c)
      subscribedChannels.delete(c)
      toRemove.push(c)
    } else {
      channelRefCounts.set(c, count)
    }
  }
  if (toRemove.length > 0) {
    await _subscriber.unsubscribe(...toRemove)
  }
}

export async function connectRedis() {
  await redis.connect()
  await _subscriber.connect()
}

export async function publishEvent(channel: string, data: unknown) {
  await redis.publish(channel, JSON.stringify(data))
}