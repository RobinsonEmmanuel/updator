import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

export interface RlJwtPayload {
  sub: string
  email: string
  role?: string
  exp: number
}

declare global {
  namespace Express {
    interface Request {
      rlUserId?: string
      rlEmail?: string
      rlPayload?: RlJwtPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", code: "NO_TOKEN" })
    return
  }

  const token = auth.slice(7)
  const decoded = jwt.decode(token) as RlJwtPayload | null

  if (!decoded?.sub || typeof decoded.exp !== "number") {
    res.status(401).json({ error: "Invalid token", code: "INVALID_TOKEN" })
    return
  }

  if (decoded.exp * 1000 < Date.now()) {
    res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" })
    return
  }

  req.rlUserId = decoded.sub
  req.rlEmail = decoded.email
  req.rlPayload = decoded
  next()
}
