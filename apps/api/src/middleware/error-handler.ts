import type { Context, MiddlewareHandler } from 'hono';
import type { AppContext } from '../env.js';
import { toErrorResponse, ConnexyError } from '@connexy/shared';

export const errorHandler: MiddlewareHandler<AppContext> = async (c, next) => {
  const start = Date.now();
  c.header('X-Request-ID', c.get('requestId') || crypto.randomUUID());
  try {
    await next();
  } catch (err) {
    const response = toErrorResponse(err);
    const statusCode = response.error.statusCode || 500;
    c.header('X-Request-Duration', String(Date.now() - start));
    if (err instanceof ConnexyError && err.details) {
      return c.json(response, statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503);
    }
    console.error('Unhandled error:', err);
    return c.json(response, statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503);
  }
  c.header('X-Request-Duration', String(Date.now() - start));
};