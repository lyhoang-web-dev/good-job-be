import { Queue } from 'bullmq'
import { redisConnection } from './redis'

export const mediaQueue = new Queue('media', { connection: redisConnection })
