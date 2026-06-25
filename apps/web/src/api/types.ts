export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  workflow_type: 'mes-to-machine' | 'kpi-dashboard';
  intent: string;
  status: 'draft' | 'running' | 'review' | 'approved' | 'exported' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Connector {
  id: string;
  tenant_id: string;
  project_id?: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  credentials_ref: string;
  status: 'configured' | 'validated' | 'syncing' | 'error' | 'disabled';
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MetadataObject {
  id: string;
  connector_id: string;
  external_id: string;
  name: string;
  type: string;
  path?: string;
  description?: string;
  data_type?: string;
  unit_of_measure?: string;
  properties: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Mapping {
  id: string;
  project_id: string;
  source_object_id: string;
  target_object_id: string;
  transformation?: Record<string, unknown>;
  confidence: number;
  evidence: Evidence[];
  status: 'proposed' | 'accepted' | 'rejected' | 'modified';
  proposed_by: 'ai' | 'human';
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  type: string;
  sourceRef: string;
  description: string;
  weight: number;
}

export interface Gap {
  id: string;
  project_id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affected_objects: string[];
  recommendation?: string;
  confidence: number;
  evidence: Evidence[];
  status: 'open' | 'acknowledged' | 'resolved' | 'wont-fix';
  created_at: string;
  updated_at: string;
}

export interface SemanticModel {
  id: string;
  project_id: string;
  name: string;
  version: number;
  entities: SemanticEntity[];
  relationships: SemanticRelationship[];
  status: 'draft' | 'review' | 'approved' | 'published';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SemanticEntity {
  id: string;
  name: string;
  type: 'fact' | 'dimension' | 'measure' | 'kpi' | 'hierarchy';
  description?: string;
  sourceMappings: string[];
  attributes: SemanticAttribute[];
  provenance: {
    proposedBy: 'ai' | 'human';
    confidence?: number;
    evidence: Evidence[];
    acceptedAt?: string;
    acceptedBy?: string;
  };
}

export interface SemanticAttribute {
  name: string;
  dataType: string;
  isKey?: boolean;
  isNullable?: boolean;
  description?: string;
  sourceMappingId?: string;
}

export interface SemanticRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  fromAttribute: string;
  toAttribute: string;
}

export interface WorkflowState {
  projectId: string;
  currentStage: string;
  stages: Record<string, StageState>;
  events: WorkflowEvent[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export interface StageState {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
}

export interface WorkflowEvent {
  id: string;
  stage: string;
  type: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ExportPackage {
  id: string;
  project_id: string;
  type: string;
  format: string;
  r2_key: string;
  status: 'generating' | 'ready' | 'failed';
  generated_by: string;
  generated_at: string;
  expires_at?: string;
}

export interface ReviewQueue {
  projectId: string;
  pending: {
    mappings: number;
    gaps: number;
    models: number;
  };
  items: {
    mappings: Mapping[];
    gaps: Gap[];
    models: SemanticModel[];
  };
}

export interface ProjectCost {
  projectId: string;
  totalCost: number;
  totalCalls: number;
  byTier: Record<string, { count: number; cost: number; tokens: number }>;
}