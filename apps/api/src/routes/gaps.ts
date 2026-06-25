import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '@connexy/shared';

export const gapRoutes = new Hono<AppContext>();

async function writeAuditEntry(c: AppContext, action: string, entityType: string, entityId: string, before: unknown, after: unknown): Promise<void> {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const doId = c.env.AUDIT_LOG.idFromName(tenantId);
  const stub = c.env.AUDIT_LOG.get(doId);
  c.executionCtx.waitUntil(
    stub.fetch('https://internal/audit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: crypto.randomUUID(), tenantId, userId, action, entityType, entityId, before, after, timestamp: new Date().toISOString() }),
    }).catch(() => {}),
  );
}

gapRoutes.get('/', async (c) => {
  const projectId = c.req.query('projectId');
  if (!projectId) throw new ValidationError('projectId query param required');
  const severity = c.req.query('severity');
  let query = 'SELECT * FROM gaps WHERE project_id = ?';
  const params: unknown[] = [projectId];
  if (severity) {
    query += ' AND severity = ?';
    params.push(severity);
  }
  query += ' ORDER BY severity ASC, created_at DESC';
  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ gaps: result.results });
});

gapRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const gap = await c.env.DB.prepare('SELECT * FROM gaps WHERE id = ?').bind(id).first();
  if (!gap) throw new NotFoundError('Gap', id);
  return c.json({ gap });
});

gapRoutes.post('/:id/acknowledge', requireRole('admin', 'architect', 'engineer', 'reviewer'), async (c) => {
  const id = c.req.param('id');
  const now = new Date().toISOString();
  const before = await c.env.DB.prepare('SELECT * FROM gaps WHERE id = ?').bind(id).first();
  await c.env.DB.prepare('UPDATE gaps SET status = ?, updated_at = ? WHERE id = ?').bind('acknowledged', now, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM gaps WHERE id = ?').bind(id).first();
  await writeAuditEntry(c, 'gap.acknowledge', 'gap', id, before, updated);
  return c.json({ gap: updated });
});

gapRoutes.post('/:id/resolve', requireRole('admin', 'architect', 'engineer'), async (c) => {
  const id = c.req.param('id');
  const now = new Date().toISOString();
  const before = await c.env.DB.prepare('SELECT * FROM gaps WHERE id = ?').bind(id).first();
  await c.env.DB.prepare('UPDATE gaps SET status = ?, updated_at = ? WHERE id = ?').bind('resolved', now, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM gaps WHERE id = ?').bind(id).first();
  await writeAuditEntry(c, 'gap.resolve', 'gap', id, before, updated);
  return c.json({ gap: updated });
});

gapRoutes.post('/:id/wont-fix', requireRole('admin', 'architect'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'UPDATE gaps SET status = ?, recommendation = ?, updated_at = ? WHERE id = ?',
  ).bind('wont-fix', body.reason || '', now, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM gaps WHERE id = ?').bind(id).first();
  return c.json({ gap: updated });
});