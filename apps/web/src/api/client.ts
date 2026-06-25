import type {
  Project, Connector, Mapping, Gap, SemanticModel,
  WorkflowState, ExportPackage, ReviewQueue, MetadataObject, ProjectCost,
} from './types.js';

const API_BASE = import.meta.env.PROD
  ? 'https://connexy-api.becem-bejaoui.workers.dev/api'
  : '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('connexy_token') || '';
  const tenantId = localStorage.getItem('connexy_tenant_id') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': tenantId,
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
  });
  if (response.status === 401) {
    localStorage.removeItem('connexy_token');
    localStorage.removeItem('connexy_tenant_id');
    localStorage.removeItem('connexy_user_email');
    localStorage.removeItem('connexy_user_name');
    localStorage.removeItem('connexy_user_role');
    window.location.reload();
    throw new Error('Session expired');
  }
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(errorBody.error?.message || `API error ${response.status}`);
  }
  return response.json();
}

export const authApi = {
  login: async (email: string, password: string, tenantId: string) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenantId }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: 'Login failed' } }));
      throw new Error(err.error?.message || `Login failed (${response.status})`);
    }
    return response.json() as Promise<{ token: string; user: { id: string; email: string; name: string; role: string; tenantId: string } }>;
  },
  ssoCallback: async (code: string, tenantId: string, email?: string, name?: string) => {
    const response = await fetch(`${API_BASE}/auth/sso/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, tenantId, email, name }),
    });
    if (!response.ok) throw new Error('SSO callback failed');
    return response.json() as Promise<{ token: string; user: { id: string; email: string; name: string; role: string; tenantId: string } }>;
  },
};

export const api = {
  // Projects
  listProjects: (params?: { status?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    return apiFetch<{ projects: Project[] }>(`/projects?${qs}`);
  },
  getProject: (id: string) => apiFetch<{ project: Project }>(`/projects/${id}`),
  createProject: (data: { name: string; description?: string; workflowType: string; intent: string }) =>
    apiFetch<{ project: Project }>(`/projects`, { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: Partial<Project>) =>
    apiFetch<{ project: Project }>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  archiveProject: (id: string) =>
    apiFetch<{ archived: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  runProject: (id: string) =>
    apiFetch<{ projectId: string; status: string; workflowInstance: unknown }>(`/projects/${id}/run`, { method: 'POST' }),

  // Connectors
  listConnectors: (projectId?: string) => {
    const qs = projectId ? `?projectId=${projectId}` : '';
    return apiFetch<{ connectors: Connector[] }>(`/connectors${qs}`);
  },
  getConnector: (id: string) => apiFetch<{ connector: Connector }>(`/connectors/${id}`),
  createConnector: (data: { projectId?: string; type: string; name: string; config: Record<string, unknown>; credentialsRef?: string }) =>
    apiFetch<{ connector: Connector }>(`/connectors`, { method: 'POST', body: JSON.stringify(data) }),
  testScanConnector: (id: string) =>
    apiFetch<{ connectorId: string; status: string; message: string }>(`/connectors/${id}/test-scan`, { method: 'POST' }),
  getConnectorMetadata: (id: string) =>
    apiFetch<{ connectorId: string; objects: MetadataObject[] }>(`/connectors/${id}/metadata`),
  disableConnector: (id: string) =>
    apiFetch<{ disabled: boolean }>(`/connectors/${id}`, { method: 'DELETE' }),

  // Mappings
  listMappings: (projectId: string, status?: string) => {
    const qs = new URLSearchParams({ projectId });
    if (status) qs.set('status', status);
    return apiFetch<{ mappings: Mapping[] }>(`/mappings?${qs}`);
  },
  getMapping: (id: string) => apiFetch<{ mapping: Mapping }>(`/mappings/${id}`),
  acceptMapping: (id: string) => apiFetch<{ mapping: Mapping }>(`/mappings/${id}/accept`, { method: 'POST' }),
  rejectMapping: (id: string, reason?: string) =>
    apiFetch<{ mapping: Mapping }>(`/mappings/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  modifyMapping: (id: string, data: Partial<Mapping>) =>
    apiFetch<{ mapping: Mapping }>(`/mappings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Semantic Models
  listModels: (projectId: string) => apiFetch<{ models: SemanticModel[] }>(`/semantic-models?projectId=${projectId}`),
  getModel: (id: string) => apiFetch<{ model: SemanticModel }>(`/semantic-models/${id}`),
  approveModel: (id: string) => apiFetch<{ model: SemanticModel }>(`/semantic-models/${id}/approve`, { method: 'POST' }),
  publishModel: (id: string) => apiFetch<{ model: SemanticModel }>(`/semantic-models/${id}/publish`, { method: 'POST' }),

  // Gaps
  listGaps: (projectId: string, severity?: string) => {
    const qs = new URLSearchParams({ projectId });
    if (severity) qs.set('severity', severity);
    return apiFetch<{ gaps: Gap[] }>(`/gaps?${qs}`);
  },
  acknowledgeGap: (id: string) => apiFetch<{ gap: Gap }>(`/gaps/${id}/acknowledge`, { method: 'POST' }),
  resolveGap: (id: string) => apiFetch<{ gap: Gap }>(`/gaps/${id}/resolve`, { method: 'POST' }),
  wontFixGap: (id: string, reason: string) =>
    apiFetch<{ gap: Gap }>(`/gaps/${id}/wont-fix`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Reviews
  getReviewQueue: (projectId: string) => apiFetch<ReviewQueue>(`/reviews/${projectId}`),
  bulkAccept: (projectId: string, ids: string[]) =>
    apiFetch<{ projectId: string; accepted: number; requested: number }>(`/reviews/${projectId}/bulk-accept`, { method: 'POST', body: JSON.stringify({ ids }) }),
  completeReview: (projectId: string) =>
    apiFetch<{ projectId: string; status: string }>(`/reviews/${projectId}/complete`, { method: 'POST' }),

  // Workflow
  getWorkflowState: (projectId: string) => apiFetch<WorkflowState>(`/workflows/${projectId}/state`),
  cancelWorkflow: (projectId: string) =>
    apiFetch<unknown>(`/workflows/${projectId}/cancel`, { method: 'POST' }),
  getWorkflowEvents: (projectId: string) => apiFetch<{ projectId: string; events: WorkflowEvent[] }>(`/workflows/${projectId}/events`),
  getProjectCost: (projectId: string) => apiFetch<ProjectCost>(`/workflows/${projectId}/cost`),

  // Admin
  getAdminStats: () => apiFetch<{ projects: Array<{ count: number; status: string }>; connectors: Array<{ count: number; status: string }>; modelCalls: Array<{ count: number; total_cost: number; model_tier: string }> }>(`/admin/stats`),
  getModelSpend: () => apiFetch<{ projectSpend: Array<{ projectId: string; name: string; total_cost: number; calls: number }> }>(`/admin/model-spend`),
  getAuditTrail: (entityId: string) => apiFetch<{ entityId: string; entries: unknown[] }>(`/admin/audit/${entityId}`),

  // Reuse Catalogue
  listReuseArtifacts: (scope?: string) => {
    const qs = scope && scope !== 'all' ? `?scope=${scope}` : '';
    return apiFetch<{ artifacts: Array<{ id: string; scope: string; artifact_type: string; name: string; promoted_at: string }> }>(`/admin/reuse${qs}`).catch(() => ({ artifacts: [] }));
  },
  promoteArtifact: (data: { artifactId: string; artifactType: string; name: string; scope: string; sourceProjectId: string }) =>
    apiFetch<{ artifact: unknown }>(`/admin/reuse/promote`, { method: 'POST', body: JSON.stringify(data) }).catch(() => ({ artifact: null })),

  // Exports
  listExports: (projectId?: string) => {
    const qs = projectId ? `?projectId=${projectId}` : '';
    return apiFetch<{ packages: ExportPackage[] }>(`/exports${qs}`);
  },
  createExport: (data: { projectId: string; type?: string; format?: string }) =>
    apiFetch<{ packageId: string; status: string }>(`/exports`, { method: 'POST', body: JSON.stringify(data) }),
  downloadExport: (id: string) => window.open(`${API_BASE}/exports/${id}/download`, '_blank'),
};