import { Request, Response, NextFunction } from 'express'
import { jwt } from '../lib/stubs'
import { config } from '../config'

export interface AuthenticatedUser {
  id: string
  email: string
  workspaceId: string
}

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header', code: 'UNAUTHORIZED' })
    return
  }

  const token = authHeader.slice(7)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = jwt.verify(token, config.jwtSecret) as AuthenticatedUser & Record<string, any>
    req.user = {
      id: payload.id,
      email: payload.email,
      workspaceId: payload.workspaceId,
    }
    next()
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' })
  }
}
