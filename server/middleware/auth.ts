import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../services/supabase.js';

export interface AuthUser {
  id: string;
  email: string;
}

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      accessToken?: string;
    }
  }
}

/**
 * Verifies the Bearer token in the Authorization header using Supabase Auth.
 * Attaches req.user and req.accessToken on success.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    return;
  }

  const token = header.slice(7);

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
      return;
    }

    req.user = { id: data.user.id, email: data.user.email! };
    req.accessToken = token;
    next();
  } catch {
    res.status(401).json({ error: 'Authentication failed.' });
  }
}

/**
 * Optional auth — attaches user if token is valid but does not block the request.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const { data } = await supabaseAdmin.auth.getUser(token);
      if (data.user) {
        req.user = { id: data.user.id, email: data.user.email! };
        req.accessToken = token;
      }
    } catch { /* ignore */ }
  }
  next();
}
