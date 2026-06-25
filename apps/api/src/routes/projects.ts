import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { ProjectSchema } from '@connexy/shared';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '@connexy/shared';

export const projectRoutes = new Hono<AppContext>();

projectRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const limit = Math.min(Number(c.req.query('limit') || 50), 100);
  const offset = Number(c.req.query('offset') || 0);
  const status = c.req.query('status');

  let query = 'SELECT * FROM projects WHERE tenant_id = ?';
  const params: unknown[] = [tenantId];
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ projects: result.results, total: result.results.length, limit, offset });
});

projectRoutes.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const project = await c.env.DB.prepare(
    'SELECT * FROM projects WHERE id = ? AND tenant_id = ?',
  ).bind(id, tenantId).first();

  if (!project) {
    throw new NotFoundError('Project', id);
  }
  return c.json({ project });
});

projectRoutes.post('/', requireRole('admin', 'architect', 'engineer'), async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  if (!body.name || !body.intent || !body.workflowType) {
    throw new ValidationError('name, intent, and workflowType are required');
  }
  if (!['mes-to-machine', 'kpi-dashboard'].includes(body.workflowType)) {
    throw new ValidationError('workflowType must be mes-to-machine or kpi-dashboard');
  }

  const projectData = {
    id: crypto.randomUUID(),
    tenantId,
    name: body.name,
    description: body.description || null,
    workflowType: body.workflowType,
    intent: body.intent,
    status: 'draft',
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await c.env.DB.prepare(
    `INSERT INTO projects (id, tenant_id, name, description, workflow_type, intent, status, project_price_usd, model_spend_cap_usd, model_spend_cap_percentage, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    projectData.id, projectData.tenantId, projectData.name, projectData.description,
    projectData.workflowType, projectData.intent, projectData.status,
    body.projectPriceUsd || null, body.modelSpendCapUsd || null, body.modelSpendCapPercentage || 3,
    projectData.createdBy, projectData.createdAt, projectData.updatedAt,
  ).run();

  return c.json({ project: projectData }, 201);
});

projectRoutes.patch('/:id', requireRole('admin', 'architect', 'engineer'), async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await c.env.DB.prepare(
    'SELECT * FROM projects WHERE id = ? AND tenant_id = ?',
  ).bind(id, tenantId).first();

  if (!existing) {
    throw new NotFoundError('Project', id);
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (['name', 'description', 'workflow_type', 'intent', 'status', 'project_price_usd', 'model_spend_cap_usd', 'model_spend_cap_percentage'].includes(key)) {
      updates.push(`${key} = ?`);
      params.push(value);
    }
  }
  if (updates.length === 0) {
    return c.json({ project: existing });
  }
  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id, tenantId);

  await c.env.DB.prepare(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
  ).bind(...params).run();

  const updated = await c.env.DB.prepare(
    'SELECT * FROM projects WHERE id = ? AND tenant_id = ?',
  ).bind(id, tenantId).first();

  return c.json({ project: updated });
});

projectRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM projects WHERE id = ? AND tenant_id = ?',
  ).bind(id, tenantId).first();

  if (!existing) {
    throw new NotFoundError('Project', id);
  }

  await c.env.DB.prepare(
    'UPDATE projects SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
  ).bind('archived', new Date().toISOString(), id, tenantId).run();

  return c.json({ archived: true, id });
});

projectRoutes.post('/:id/run', requireRole('admin', 'architect', 'engineer'), async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const id = c.req.param('id');

  const project = await c.env.DB.prepare(
    'SELECT * FROM projects WHERE id = ? AND tenant_id = ?',
  ).bind(id, tenantId).first();

  if (!project) {
    throw new NotFoundError('Project', id);
  }

  const inst = await c.env.DISCOVERY_WORKFLOW.create({
    id: crypto.randomUUID(),
    params: { projectId: id, tenantId, userId },
  });

  await c.env.DB.prepare(
    'UPDATE projects SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
  ).bind('running', new Date().toISOString(), id, tenantId).run();

  return c.json({ projectId: id, status: 'running', workflowInstanceId: inst.id });
});