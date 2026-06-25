import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { AppContext } from './env.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { auditMiddleware } from './middleware/audit.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { connectorRoutes } from './routes/connectors.js';
import { mappingRoutes } from './routes/mappings.js';
import { modelRoutes } from './routes/semantic-models.js';
import { gapRoutes } from './routes/gaps.js';
import { reviewRoutes } from './routes/reviews.js';
import { exportRoutes } from './routes/exports.js';
import { workflowRoutes } from './routes/workflows.js';
import { adminRoutes } from './routes/admin.js';

const app = new Hono<AppContext>();

app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: (origin) => origin,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID'],
  exposeHeaders: ['X-Request-ID', 'X-Request-Duration'],
  credentials: true,
  maxAge: 86400,
}));

app.use('*', errorHandler);
app.use('*', auditMiddleware);

app.route('/health', healthRoutes);
app.route('/api/auth', authRoutes);

app.use('/api/*', authMiddleware);
app.use('/api/*', tenantMiddleware);

app.route('/api/projects', projectRoutes);
app.route('/api/connectors', connectorRoutes);
app.route('/api/mappings', mappingRoutes);
app.route('/api/semantic-models', modelRoutes);
app.route('/api/gaps', gapRoutes);
app.route('/api/reviews', reviewRoutes);
app.route('/api/exports', exportRoutes);
app.route('/api/workflows', workflowRoutes);
app.route('/api/admin', adminRoutes);

app.notFound((c) => {
  return c.json({ error: { code: 'NOT_FOUND', message: 'Route not found', statusCode: 404 } }, 404);
});

export default app;