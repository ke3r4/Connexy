export { AuditLogDO } from './durable-objects/audit-log-do.js';
export { ProjectCoordinatorDO } from './durable-objects/project-coordinator-do.js';
export { DiscoveryWorkflow } from './workflows/discovery-workflow.js';
export { default as app } from './app.js';
export { handleQueue } from './queues.js';

import app from './app.js';
import { handleQueue } from './queues.js';
import type { Env, QueueMessage } from './env.js';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    await handleQueue(batch, env);
  },
};