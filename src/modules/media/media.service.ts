import { prisma } from '../../lib/prisma'
import { mediaQueue } from '../../lib/queues'
import { AppError } from '../../middleware/errorHandler.middleware'
import { config } from '../../config'

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/mp4',
  'video/quicktime',
]

export const mediaService = {
  async uploadMedia(
    kudoId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new AppError(400, 'File type not allowed')
    }

    const isVideo = file.mimetype.startsWith('video/')

    const media = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; sender_id: string }[]>`
        SELECT id, sender_id FROM kudos WHERE id = ${kudoId} FOR UPDATE
      `
      if (!rows.length) throw new AppError(404, 'Kudo not found')
      if (rows[0].sender_id !== userId) {
        throw new AppError(403, 'Only the sender can attach media to this kudo')
      }

      const existingCount = await tx.kudoMedia.count({ where: { kudoId } })
      if (existingCount >= config.MAX_MEDIA_PER_KUDO) {
        throw new AppError(
          400,
          `Maximum ${config.MAX_MEDIA_PER_KUDO} media files per kudo`,
        )
      }

      return tx.kudoMedia.create({
        data: {
          kudoId,
          type: isVideo ? 'video' : 'image',
          url: `/uploads/${file.filename}`,
          status: isVideo ? 'processing' : 'ready',
        },
      })
    })

    if (isVideo) {
      await mediaQueue.add(
        'process-video',
        { mediaId: media.id, filePath: file.path },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      )
    }

    return media
  },
}
