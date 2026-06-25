import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { requireRole } from '../middleware/auth.js';

export const adminRoutes = new Hono<AppContext>();

adminRoutes.get('/stats', requireRole('admin'), async (c) => {
  const tenantId = c.get('tenantId');
  const projects = await c.env.DB.prepare(
    'SELECT COUNT(*) as count, status FROM projects WHERE tenant_id = ? GROUP BY status',
  ).bind(tenantId).all();
  const connectors = await c.env.DB.prepare(
    'SELECT COUNT(*) as count, status FROM connectors WHERE tenant_id = ? GROUP BY status',
  ).bind(tenantId).all();
  const modelCalls = await c.env.DB.prepare(
    `SELECT COUNT(*) as count, SUM(cost_usd) as total_cost, model_tier
     FROM model_calls WHERE project_id IN (SELECT id FROM projects WHERE tenant_id = ?)
     GROUP BY model_tier`,
  ).bind(tenantId).all();
  return c.json({
    projects: projects.results,
    connectors: connectors.results,
    modelCalls: modelCalls.results,
  });
});

adminRoutes.get('/audit/:entityId', requireRole('admin'), async (c) => {
  const entityId = c.req.param('entityId');
  const tenantId = c.get('tenantId');
  const doId = c.env.AUDIT_LOG.idFromName(tenantId);
  const stub = c.env.AUDIT_LOG.get(doId);
  const resp = await stub.fetch(`https://internal/audit/${entityId}`);
  const entries = await resp.json();
  return c.json(entries);
});

adminRoutes.get('/model-spend', requireRole('admin', 'architect'), async (c) => {
  const tenantId = c.get('tenantId');
  const result = await c.env.DB.prepare(
    `SELECT p.id as projectId, p.name, SUM(mc.cost_usd) as total_cost, COUNT(mc.id) as calls
     FROM projects p LEFT JOIN model_calls mc ON p.id = mc.project_id
     WHERE p.tenant_id = ?
     GROUP BY p.id, p.name ORDER BY total_cost DESC`,
  ).bind(tenantId).all();
  return c.json({ projectSpend: result.results });
});

adminRoutes.get('/reuse', async (c) => {
  const tenantId = c.get('tenantId');
  const scope = c.req.query('scope');
  let query = 'SELECT * FROM reuse_catalogue WHERE tenant_id = ?';
  const params: unknown[] = [tenantId];
  if (scope && scope !== 'all') {
    query += ' AND scope = ?';
    params.push(scope);
  }
  query += ' ORDER BY promoted_at DESC';
  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ artifacts: result.results });
});

adminRoutes.post('/reuse/promote', requireRole('admin', 'architect'), async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO reuse_catalogue (id, tenant_id, scope, artifact_type, artifact_id, name, source_project_id, promoted_by, promoted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, tenantId, body.scope || 'site', body.artifactType,
    body.artifactId, body.name, body.sourceProjectId || null,
    userId, now,
  ).run();
  return c.json({ artifact: { id, ...body, promotedAt: now } }, 201);
});