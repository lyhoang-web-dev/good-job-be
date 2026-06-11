import { Response } from 'express'

export function ok<T>(res: Response, data: T, message = 'success') {
  return res.status(200).json({ data, message })
}

export function created<T>(res: Response, data: T, message = 'created') {
  return res.status(201).json({ data, message })
}
