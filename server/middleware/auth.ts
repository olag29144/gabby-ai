import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { getUserRole, logAudit } from '../services/developerIdentity.js';
import type { UserRole } from '../services/developerIdentity.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      accessToken?: string;
    }
  }
}

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
    const role = await getUserRole(data.user.id);
    req.user = { id: data.user.id, email: data.user.email!, role };
    req.accessToken = token;
    next();
  } catch {
    res.status(401).json({ error: 'Authentication failed.' });
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const { data } = await supabaseAdmin.auth.getUser(token);
      if (data.user) {
        const role = await getUserRole(data.user.id);
        req.user = { id: data.user.id, email: data.user.email!, role };
        req.accessToken = token;
      }
    } catch { /* ignore */ }
  }
  next();
}

/** Only allows owner role through */
export async function requireOwner(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    if (req.user?.role !== 'owner') {
      await logAudit(req.user?.id ?? null, 'unauthorized_owner_access', req.path, {
        method: req.method,
        ip: req.ip,
      });
      res.status(403).json({ error: 'Access denied. Owner privileges required.' });
      return;
    }
    next();
  });
}

/** Only allows admin or owner through */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'owner')) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }
    next();
  });
}
