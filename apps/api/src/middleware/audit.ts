import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../env.js';

export const auditMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();
  c.set('requestId', requestId);

  const method = c.req.method;
  if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
    await next();
    return;
  }

  await next();

  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId || !userId) return;

  const status = c.res.status;
  if (status >= 400) return;

  const path = c.req.path;
  const action = `${method}:${path}`;
  const auditEntry = {
    id: crypto.randomUUID(),
    tenantId,
    userId,
    action,
    entityType: 'api',
    entityId: path,
    timestamp: new Date().toISOString(),
  };

  const doId = c.env.AUDIT_LOG.idFromName(tenantId);
  const stub = c.env.AUDIT_LOG.get(doId);
  c.executionCtx.waitUntil(
    stub.fetch('https://internal/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auditEntry),
    }).catch((err: unknown) => console.error('Audit write failed:', err)),
  );
};