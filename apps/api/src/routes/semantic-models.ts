import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError } from '@connexy/shared';

export const modelRoutes = new Hono<AppContext>();

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

modelRoutes.get('/', async (c) => {
  const projectId = c.req.query('projectId');
  if (!projectId) return c.json({ models: [] });
  const result = await c.env.DB.prepare(
    'SELECT * FROM semantic_models WHERE project_id = ? ORDER BY version DESC',
  ).bind(projectId).all();
  return c.json({ models: result.results });
});

modelRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const model = await c.env.DB.prepare('SELECT * FROM semantic_models WHERE id = ?').bind(id).first();
  if (!model) throw new NotFoundError('SemanticModel', id);
  return c.json({ model });
});

modelRoutes.post('/:id/approve', requireRole('admin', 'architect', 'reviewer'), async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const now = new Date().toISOString();
  const before = await c.env.DB.prepare('SELECT * FROM semantic_models WHERE id = ?').bind(id).first();
  await c.env.DB.prepare('UPDATE semantic_models SET status = ?, updated_at = ? WHERE id = ?').bind('approved', now, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM semantic_models WHERE id = ?').bind(id).first();
  await writeAuditEntry(c, 'model.approve', 'semantic_model', id, before, updated);
  return c.json({ model: updated, approvedBy: userId });
});

modelRoutes.post('/:id/publish', requireRole('admin', 'architect'), async (c) => {
  const id = c.req.param('id');
  const now = new Date().toISOString();
  const before = await c.env.DB.prepare('SELECT * FROM semantic_models WHERE id = ?').bind(id).first();
  await c.env.DB.prepare('UPDATE semantic_models SET status = ?, updated_at = ? WHERE id = ?').bind('published', now, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM semantic_models WHERE id = ?').bind(id).first();
  await writeAuditEntry(c, 'model.publish', 'semantic_model', id, before, updated);
  return c.json({ model: updated });
});