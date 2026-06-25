import { DurableObject } from 'durable-objects';

interface WorkflowState {
  projectId: string;
  currentStage: string;
  stages: Record<string, StageState>;
  events: WorkflowEvent[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

interface StageState {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
}

interface WorkflowEvent {
  id: string;
  stage: string;
  type: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const STAGE_ORDER = ['plan', 'ingest', 'classify', 'map', 'model', 'score', 'review', 'export'];

export class ProjectCoordinatorDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const projectId = url.pathname.split('/')[2];

    if (url.pathname.startsWith('/state/') && request.method === 'GET') {
      const state = await this.ctx.storage.get<WorkflowState>(`state:${projectId}`);
      if (!state) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      return Response.json(state);
    }

    if (url.pathname.startsWith('/cancel/') && request.method === 'POST') {
      const state = await this.ctx.storage.get<WorkflowState>(`state:${projectId}`);
      if (!state) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      state.error = 'Cancelled by user';
      state.completedAt = new Date().toISOString();
      state.updatedAt = new Date().toISOString();
      await this.ctx.storage.put(`state:${projectId}`, state);
      return Response.json({ projectId, cancelled: true });
    }

    if (url.pathname.startsWith('/events/') && request.method === 'GET') {
      const state = await this.ctx.storage.get<WorkflowState>(`state:${projectId}`);
      if (!state) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      return Response.json({ projectId, events: state.events });
    }

    if (url.pathname === '/update' && request.method === 'POST') {
      const body = await request.json() as {
        projectId: string;
        stage: string;
        status: StageState['status'];
        output?: Record<string, unknown>;
        error?: string;
        event?: Omit<WorkflowEvent, 'id' | 'timestamp'>;
      };
      const { projectId: pid, stage, status, output, error, event } = body;
      let state = await this.ctx.storage.get<WorkflowState>(`state:${pid}`);
      const now = new Date().toISOString();
      if (!state) {
        state = {
          projectId: pid,
          currentStage: stage,
          stages: {},
          events: [],
          startedAt: now,
          updatedAt: now,
        };
      }
      if (!state.stages[stage]) {
        state.stages[stage] = { status: 'pending' };
      }
      state.stages[stage].status = status;
      if (status === 'running') state.stages[stage].startedAt = now;
      if (status === 'completed' || status === 'failed') state.stages[stage].completedAt = now;
      if (output) state.stages[stage].output = output;
      if (error) state.stages[stage].error = error;
      if (event) {
        state.events.push({
          ...event,
          id: crypto.randomUUID(),
          timestamp: now,
        });
      }
      state.currentStage = stage;
      state.updatedAt = now;
      if (status === 'completed' && stage === 'export') {
        state.completedAt = now;
      }
      await this.ctx.storage.put(`state:${pid}`, state);
      return Response.json(state);
    }

    return new Response('Not found', { status: 404 });
  }
}