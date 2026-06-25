import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError } from '@connexy/shared';

export const exportRoutes = new Hono<AppContext>();

exportRoutes.get('/', async (c) => {
  const projectId = c.req.query('projectId');
  let query = 'SELECT * FROM export_packages WHERE 1=1';
  const params: unknown[] = [];
  if (projectId) {
    query += ' AND project_id = ?';
    params.push(projectId);
  }
  query += ' ORDER BY generated_at DESC';
  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ packages: result.results });
});

exportRoutes.post('/', requireRole('admin', 'architect', 'engineer', 'reviewer'), async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const r2Key = `exports/${body.projectId}/${id}.${body.format || 'json'}`;
  await c.env.DB.prepare(
    `INSERT INTO export_packages (id, project_id, type, format, r2_key, status, generated_by, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, body.projectId, body.type || 'full', body.format || 'json', r2Key, 'generating', userId, now).run();
  await c.env.EXPORT_QUEUE.send({
    type: 'generate-export',
    projectId: body.projectId,
    packageId: id,
    r2Key,
    format: body.format || 'json',
    exportType: body.type || 'full',
  });
  return c.json({ packageId: id, status: 'generating' }, 202);
});

exportRoutes.get('/:id/download', async (c) => {
  const id = c.req.param('id');
  const pkg = await c.env.DB.prepare('SELECT * FROM export_packages WHERE id = ?').bind(id).first();
  if (!pkg) throw new NotFoundError('ExportPackage', id);
  if (pkg.status !== 'ready') {
    return c.json({ error: { code: 'NOT_READY', message: 'Package is not ready', statusCode: 409 } }, 409);
  }
  const object = await c.env.R2_BUCKET.get(pkg.r2_key as string);
  if (!object) throw new NotFoundError('R2Object', pkg.r2_key as string);
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="connexy-export-${id}.${pkg.format}"`,
    },
  });
});