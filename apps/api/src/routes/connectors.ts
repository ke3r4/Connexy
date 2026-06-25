import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ReadOnlyViolationError } from '@connexy/shared';
import { ConnectorTypeSchema } from '@connexy/shared';

export const connectorRoutes = new Hono<AppContext>();

connectorRoutes.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const projectId = c.req.query('projectId');
  let query = 'SELECT * FROM connectors WHERE tenant_id = ?';
  const params: unknown[] = [tenantId];
  if (projectId) {
    query += ' AND project_id = ?';
    params.push(projectId);
  }
  query += ' ORDER BY created_at DESC';
  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ connectors: result.results });
});

connectorRoutes.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const connector = await c.env.DB.prepare(
    'SELECT * FROM connectors WHERE id = ? AND tenant_id = ?',
  ).bind(id, tenantId).first();
  if (!connector) throw new NotFoundError('Connector', id);
  return c.json({ connector });
});

connectorRoutes.post('/', requireRole('admin', 'architect', 'engineer'), async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const typeResult = ConnectorTypeSchema.safeParse(body.type);
  if (!typeResult.success) {
    throw new ValidationError('Invalid connector type', typeResult.error.flatten());
  }

  if (body.config?.readOnlyAssertion !== true) {
    throw new ReadOnlyViolationError(
      'Connector must declare read-only assertion; Connexy never writes to source systems',
      { connectorType: body.type },
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO connectors (id, tenant_id, project_id, type, name, config, credentials_ref, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, tenantId, body.projectId || null, body.type, body.name,
    JSON.stringify(body.config || {}), body.credentialsRef || `kv:connector-creds:${id}`,
    'configured', now, now,
  ).run();

  const connector = await c.env.DB.prepare(
    'SELECT * FROM connectors WHERE id = ?',
  ).bind(id).first();
  return c.json({ connector }, 201);
});

connectorRoutes.post('/:id/test-scan', requireRole('admin', 'architect', 'engineer'), async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const connector = await c.env.DB.prepare(
    'SELECT * FROM connectors WHERE id = ? AND tenant_id = ?',
  ).bind(id, tenantId).first();
  if (!connector) throw new NotFoundError('Connector', id);
  // Enqueue a non-destructive test scan
  await c.env.INGEST_QUEUE.send({
    type: 'test-scan',
    projectId: connector.project_id as string || '',
    tenantId,
    payload: { connectorId: id },
  });
  return c.json({ connectorId: id, status: 'test-scan-queued', message: 'Read-only test scan queued' });
});

connectorRoutes.get('/:id/metadata', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(
    'SELECT * FROM metadata_objects WHERE connector_id = ?',
  ).bind(id).all();
  return c.json({ connectorId: id, objects: result.results });
});

connectorRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await c.env.DB.prepare(
    'UPDATE connectors SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
  ).bind('disabled', new Date().toISOString(), id, tenantId).run();
  return c.json({ disabled: true, id });
});