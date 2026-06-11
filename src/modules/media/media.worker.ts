import { Worker, Job } from 'bullmq'
import { prisma } from '../../lib/prisma'
import { publishEvent, redisConnection } from '../../lib/redis'
import { config } from '../../config'

interface MediaJobData {
  mediaId: string
  filePath: string
}

export function startMediaWorker() {
  const worker = new Worker<MediaJobData>(
    'media',
    async (job: Job<MediaJobData>) => {
      const { mediaId, filePath } = job.data

      const { execFile } = await import('child_process')
      const { promisify } = await import('util')
      const execFileAsync = promisify(execFile)

      const { stdout } = await execFileAsync(
        'ffprobe',
        ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath],
        { timeout: config.FFPROBE_TIMEOUT_MS },
      )

      const info = JSON.parse(stdout) as {
        format?: { duration?: string }
      }
      const duration = parseFloat(info.format?.duration ?? '0')

      if (duration > config.MAX_VIDEO_DURATION_SECS) {
        await prisma.kudoMedia.update({
          where: { id: mediaId },
          data: { status: 'failed' },
        })
        await publishEvent('media:failed', {
          mediaId,
          reason: `Video exceeds ${config.MAX_VIDEO_DURATION_SECS / 60} minutes`,
        })
        return
      }

      await prisma.kudoMedia.update({
        where: { id: mediaId },
        data: { status: 'ready', durationSecs: Math.floor(duration) },
      })
      await publishEvent('media:ready', { mediaId })
    },
    {
      connection: redisConnection,
      concurrency: config.MEDIA_WORKER_CONCURRENCY,
    },
  )

  worker.on('failed', async (job, err) => {
    console.error(`Media job ${job?.id} failed after all retries:`, err)
    if (job?.data?.mediaId) {
      await prisma.kudoMedia.update({
        where: { id: job.data.mediaId },
        data: { status: 'failed' },
      })
      await publishEvent('media:failed', {
        mediaId: job.data.mediaId,
        reason: 'Processing error',
      })
    }
  })

  return worker
}
