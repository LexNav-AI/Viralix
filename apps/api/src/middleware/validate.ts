import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }))
      res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: errors })
      return
    }
    req.body = result.data as Record<string, unknown>
    next()
  }
}
