import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { jwt } from '../lib/stubs'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }))
    res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details })
    return
  }

  if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
    res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' })
    return
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code })
    return
  }

  // Unknown errors
  console.error('[ErrorHandler]', err)
  const message = err instanceof Error ? err.message : 'Internal server error'
  res.status(500).json({ error: message, code: 'INTERNAL_ERROR' })
}

// Convenience typed error class for use throughout the app
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'APP_ERROR',
  ) {
    super(message)
    this.name = 'AppError'
  }
}
