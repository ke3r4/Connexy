import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError } from '@connexy/shared';

export const reviewRoutes = new Hono<AppContext>();

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

reviewRoutes.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const mappings = await c.env.DB.prepare(
    "SELECT * FROM mappings WHERE project_id = ? AND status = 'proposed'",
  ).bind(projectId).all();
  const gaps = await c.env.DB.prepare(
    "SELECT * FROM gaps WHERE project_id = ? AND status = 'open'",
  ).bind(projectId).all();
  const models = await c.env.DB.prepare(
    "SELECT * FROM semantic_models WHERE project_id = ? AND status IN ('draft','review')",
  ).bind(projectId).all();
  return c.json({
    projectId,
    pending: {
      mappings: mappings.results.length,
      gaps: gaps.results.length,
      models: models.results.length,
    },
    items: { mappings: mappings.results, gaps: gaps.results, models: models.results },
  });
});

reviewRoutes.post('/:projectId/bulk-accept', requireRole('admin', 'architect', 'reviewer'), async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const ids: string[] = body.ids || [];
  const now = new Date().toISOString();
  let accepted = 0;
  for (const id of ids) {
    const before = await c.env.DB.prepare('SELECT * FROM mappings WHERE id = ?').bind(id).first();
    const result = await c.env.DB.prepare(
      "UPDATE mappings SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND project_id = ? AND status = 'proposed'",
    ).bind('accepted', userId, now, now, id, projectId).run();
    if (result.meta.changes > 0) {
      accepted++;
      const after = await c.env.DB.prepare('SELECT * FROM mappings WHERE id = ?').bind(id).first();
      await writeAuditEntry(c, 'mapping.bulk_accept', 'mapping', id, before, after);
    }
  }
  return c.json({ projectId, accepted, requested: ids.length });
});

reviewRoutes.post('/:projectId/complete', requireRole('admin', 'architect', 'reviewer'), async (c) => {
  const projectId = c.req.param('projectId');
  const now = new Date().toISOString();
  const before = await c.env.DB.prepare('SELECT status FROM projects WHERE id = ?').bind(projectId).first();
  await c.env.DB.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').bind('approved', now, projectId).run();
  const after = await c.env.DB.prepare('SELECT status FROM projects WHERE id = ?').bind(projectId).first();
  await writeAuditEntry(c, 'review.complete', 'project', projectId, before, after);
  return c.json({ projectId, status: 'approved' });
});