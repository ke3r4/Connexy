import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError } from '@connexy/shared';

export const workflowRoutes = new Hono<AppContext>();

workflowRoutes.get('/:projectId/state', async (c) => {
  const projectId = c.req.param('projectId');
  const doId = c.env.PROJECT_COORDINATOR.idFromName(projectId);
  const stub = c.env.PROJECT_COORDINATOR.get(doId);
  const resp = await stub.fetch(`https://internal/state/${projectId}`);
  if (!resp.ok) throw new NotFoundError('WorkflowState', projectId);
  const state = await resp.json();
  return c.json(state);
});

workflowRoutes.post('/:projectId/cancel', requireRole('admin', 'architect', 'engineer'), async (c) => {
  const projectId = c.req.param('projectId');
  const doId = c.env.PROJECT_COORDINATOR.idFromName(projectId);
  const stub = c.env.PROJECT_COORDINATOR.get(doId);
  const resp = await stub.fetch(`https://internal/cancel/${projectId}`, { method: 'POST' });
  const result = await resp.json();
  return c.json(result);
});

workflowRoutes.get('/:projectId/events', async (c) => {
  const projectId = c.req.param('projectId');
  const doId = c.env.PROJECT_COORDINATOR.idFromName(projectId);
  const stub = c.env.PROJECT_COORDINATOR.get(doId);
  const resp = await stub.fetch(`https://internal/events/${projectId}`);
  const events = await resp.json();
  return c.json(events);
});

workflowRoutes.get('/:projectId/cost', requireRole('admin', 'architect'), async (c) => {
  const projectId = c.req.param('projectId');
  const result = await c.env.DB.prepare(
    'SELECT * FROM model_calls WHERE project_id = ? ORDER BY timestamp DESC',
  ).bind(projectId).all();
  const calls = result.results;
  const totalCost = calls.reduce((sum, call) => sum + (call.cost_usd as number), 0);
  const totalCalls = calls.length;
  const byTier = calls.reduce((acc, call) => {
    const tier = call.model_tier as string;
    acc[tier] = acc[tier] || { count: 0, cost: 0, tokens: 0 };
    acc[tier].count++;
    acc[tier].cost += call.cost_usd as number;
    acc[tier].tokens += (call.prompt_tokens as number) + (call.completion_tokens as number);
    return acc;
  }, {} as Record<string, { count: number; cost: number; tokens: number }>);
  return c.json({ projectId, totalCost, totalCalls, byTier });
});