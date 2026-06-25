import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '@connexy/shared';
import { MappingSchema } from '@connexy/shared';

export const mappingRoutes = new Hono<AppContext>();

mappingRoutes.get('/', async (c) => {
  const projectId = c.req.query('projectId');
  if (!projectId) throw new ValidationError('projectId query param required');
  const status = c.req.query('status');
  let query = 'SELECT * FROM mappings WHERE project_id = ?';
  const params: unknown[] = [projectId];
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY confidence DESC';
  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ mappings: result.results });
});

mappingRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const mapping = await c.env.DB.prepare('SELECT * FROM mappings WHERE id = ?').bind(id).first();
  if (!mapping) throw new NotFoundError('Mapping', id);
  return c.json({ mapping });
});

mappingRoutes.post('/:id/accept', requireRole('admin', 'architect', 'engineer', 'reviewer'), async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const tenantId = c.get('tenantId');
  const now = new Date().toISOString();
  // Read before state for audit diff
  const before = await c.env.DB.prepare('SELECT * FROM mappings WHERE id = ?').bind(id).first();
  await c.env.DB.prepare(
    'UPDATE mappings SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?',
  ).bind('accepted', userId, now, now, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM mappings WHERE id = ?').bind(id).first();
  // Write audit entry with before/after diff
  await writeAuditEntry(c, tenantId, userId, 'mapping.accept', 'mapping', id, before, updated);
  return c.json({ mapping: updated });
});

mappingRoutes.post('/:id/reject', requireRole('admin', 'architect', 'engineer', 'reviewer'), async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => ({}));
  const now = new Date().toISOString();
  const before = await c.env.DB.prepare('SELECT * FROM mappings WHERE id = ?').bind(id).first();
  await c.env.DB.prepare(
    'UPDATE mappings SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?',
  ).bind('rejected', userId, now, now, id).run();
  if (body.reason) {
    await c.env.DB.prepare(
      'UPDATE mappings SET metadata = ? WHERE id = ?',
    ).bind(JSON.stringify({ rejectionReason: body.reason }), id).run();
  }
  const updated = await c.env.DB.prepare('SELECT * FROM mappings WHERE id = ?').bind(id).first();
  await writeAuditEntry(c, tenantId, userId, 'mapping.reject', 'mapping', id, before, updated);
  return c.json({ mapping: updated });
});

mappingRoutes.patch('/:id', requireRole('admin', 'architect', 'engineer', 'reviewer'), async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const now = new Date().toISOString();
  const before = await c.env.DB.prepare('SELECT * FROM mappings WHERE id = ?').bind(id).first();
  const updates: string[] = [];
  const params: unknown[] = [];
  if (body.transformation) { updates.push('transformation = ?'); params.push(JSON.stringify(body.transformation)); }
  if (body.confidence !== undefined) { updates.push('confidence = ?'); params.push(body.confidence); }
  if (body.targetObjectId) { updates.push('target_object_id = ?'); params.push(body.targetObjectId); }
  updates.push('status = ?', 'reviewed_by = ?', 'reviewed_at = ?', 'updated_at = ?');
  params.push('modified', userId, now, now);
  params.push(id);
  await c.env.DB.prepare(
    `UPDATE mappings SET ${updates.join(', ')} WHERE id = ?`,
  ).bind(...params).run();
  const updated = await c.env.DB.prepare('SELECT * FROM mappings WHERE id = ?').bind(id).first();
  await writeAuditEntry(c, tenantId, userId, 'mapping.modify', 'mapping', id, before, updated);
  return c.json({ mapping: updated });
});

async function writeAuditEntry(
  c: AppContext,
  tenantId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const doId = c.env.AUDIT_LOG.idFromName(tenantId);
  const stub = c.env.AUDIT_LOG.get(doId);
  c.executionCtx.waitUntil(
    stub.fetch('https://internal/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        tenantId,
        userId,
        action,
        entityType,
        entityId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {}),
  );
}