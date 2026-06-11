import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { Router } from 'express'
import multer from 'multer'
import { mediaController } from './media.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { config } from '../../config'

const uploadDir = path.resolve(process.cwd(), config.UPLOAD_DIR)
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ''
    cb(null, `${randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
})

export const mediaRouter = Router()

mediaRouter.post(
  '/:id/media',
  authenticate,
  upload.single('file'),
  mediaController.upload,
)
