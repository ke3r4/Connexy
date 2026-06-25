import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../env.js';
import { AuthenticationError, AuthorizationError } from '@connexy/shared';

export interface JWTPayload {
  sub: string;
  tid: string;
  role: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const authMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid Authorization header');
  }
  const token = authHeader.slice(7);
  const payload = decodeJWT(token);
  if (!payload) {
    throw new AuthenticationError('Invalid or expired token');
  }
  c.set('userId', payload.sub);
  c.set('tenantId', payload.tid);
  c.set('userRole', payload.role);
  await next();
};

export function requireRole(...roles: string[]): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const userRole = c.get('userRole');
    if (!userRole || !roles.includes(userRole)) {
      throw new AuthorizationError(`Requires role: ${roles.join(' or ')}`);
    }
    await next();
  };
}