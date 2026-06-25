import { Hono } from 'hono';
import type { AppContext } from '../env.js';

export const healthRoutes = new Hono<AppContext>();

healthRoutes.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'connexy-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get('/ready', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({ status: 'ready', checks: { db: 'ok' } });
  } catch (err) {
    return c.json({ status: 'degraded', checks: { db: 'fail', error: String(err) } }, 503);
  }
});

healthRoutes.get('/live', (c) => {
  return c.json({ status: 'alive' });
});