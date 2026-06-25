export interface Env {
  // D1 — relational data
  DB: D1Database;
  // Vectorize — semantic search
  VECTORIZE: VectorizeIndex;
  // R2 — export packages
  R2_BUCKET: R2Bucket;
  // Durable Objects — audit log & coordination
  AUDIT_LOG: DurableObjectNamespace;
  PROJECT_COORDINATOR: DurableObjectNamespace;
  // KV — config & sessions
  KV_CONFIG: KVNamespace;
  KV_SESSIONS: KVNamespace;
  // Queues — stage hand-off
  INGEST_QUEUE: Queue<QueueMessage>;
  EXPORT_QUEUE: Queue<QueueMessage>;
  // AI binding (Cloudflare Workers AI — runs Mistral/GLM/Llama models)
  AI: Ai;
  // AI Gateway (for observability + caching)
  AI_GATEWAY: AiGateway;
  // Workflow binding (Cloudflare Workflows)
  DISCOVERY_WORKFLOW: Workflow;
  // Secrets
  JWT_SECRET: string;
  // Vars
  ENVIRONMENT: string;
}

export interface QueueMessage {
  type: string;
  projectId: string;
  tenantId: string;
  stage?: string;
  payload?: Record<string, unknown>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export type AppContext = {
  Env: Env;
  Bindings: Env;
  Variables: {
    tenantId: string;
    userId: string;
    userRole: string;
    requestId: string;
  };
};