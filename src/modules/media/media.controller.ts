import { Request, Response, NextFunction } from 'express'
import { mediaService } from './media.service'
import { created } from '../../utils/response'
import { routeParam } from '../../utils/params'

export const mediaController = {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({ message: 'File is required' })
        return
      }
      const media = await mediaService.uploadMedia(
        routeParam(req, 'id'),
        req.user!.id,
        req.file,
      )
      created(res, media)
    } catch (err) {
      next(err)
    }
  },
}
