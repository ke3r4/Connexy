export interface Tenant {
  id: string;
  name: string;
  slug: string;
  dataResidencyRegion: 'eu' | 'us' | 'custom';
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'admin' | 'architect' | 'engineer' | 'reviewer' | 'viewer';
  ssoSubject?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  workflowType: 'mes-to-machine' | 'kpi-dashboard';
  intent: string;
  status: 'draft' | 'running' | 'review' | 'approved' | 'exported' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Connector {
  id: string;
  tenantId: string;
  projectId?: string;
  type: 'sap-erp' | 'siemens-opcenter' | 'rockwell-factorytalk' | 'werum-pasx' | 'tulip' | 'sepasoft' | 'aveva-pi' | 'aveva-wonderware' | 'ignition' | 'opc-ua' | 'plc-tags' | 'metadata-file';
  name: string;
  config: ConnectorConfig;
  credentialsRef: string;
  status: 'configured' | 'validated' | 'syncing' | 'error' | 'disabled';
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorConfig {
  baseUrl?: string;
  scope?: string[];
  readOnlyAssertion: boolean;
  testScan?: boolean;
  [key: string]: unknown;
}

export interface MetadataObject {
  id: string;
  connectorId: string;
  externalId: string;
  name: string;
  type: 'tag' | 'field' | 'table' | 'entity' | 'attribute' | 'measure' | 'dimension' | 'hierarchy' | 'kpi';
  path?: string;
  description?: string;
  dataType?: string;
  unitOfMeasure?: string;
  sampleValues?: unknown[];
  properties: Record<string, unknown>;
  lineage: LineageRef[];
  createdAt: string;
  updatedAt: string;
}

export interface LineageRef {
  type: 'source' | 'transform' | 'target';
  refId: string;
  description?: string;
}

export interface Mapping {
  id: string;
  projectId: string;
  sourceObjectId: string;
  targetObjectId: string;
  transformation?: Transformation;
  confidence: number;
  evidence: Evidence[];
  status: 'proposed' | 'accepted' | 'rejected' | 'modified';
  proposedBy: 'ai' | 'human';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transformation {
  type: 'direct' | 'expression' | 'lookup' | 'aggregation' | 'concat' | 'conditional';
  expression?: string;
  parameters?: Record<string, unknown>;
}

export interface Evidence {
  type: 'metadata' | 'sample' | 'naming' | 'semantic' | 'lineage' | 'human';
  sourceRef: string;
  description: string;
  weight: number;
}

export interface SemanticModel {
  id: string;
  projectId: string;
  name: string;
  version: number;
  entities: SemanticEntity[];
  relationships: SemanticRelationship[];
  status: 'draft' | 'review' | 'approved' | 'published';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SemanticEntity {
  id: string;
  name: string;
  type: 'fact' | 'dimension' | 'measure' | 'kpi' | 'hierarchy';
  description?: string;
  sourceMappings: string[];
  attributes: SemanticAttribute[];
  provenance: Provenance;
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
  provenance: Provenance;
}

export interface Provenance {
  proposedBy: 'ai' | 'human';
  confidence?: number;
  evidence: Evidence[];
  acceptedAt?: string;
  acceptedBy?: string;
}

export interface Gap {
  id: string;
  projectId: string;
  type: 'missing-source' | 'missing-target' | 'type-mismatch' | 'unit-mismatch' | 'cardinality' | 'hierarchy-gap' | 'kpi-definition';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedObjects: string[];
  recommendation?: string;
  confidence: number;
  evidence: Evidence[];
  status: 'open' | 'acknowledged' | 'resolved' | 'wont-fix';
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  tenantId: string;
  projectId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: string;
  hash: string;
}

export interface ExportPackage {
  id: string;
  projectId: string;
  type: 'mapping-spec' | 'semantic-model' | 'gap-report' | 'validation-dossier' | 'full';
  format: 'json' | 'yaml' | 'xlsx' | 'pdf';
  r2Key: string;
  status: 'generating' | 'ready' | 'failed';
  generatedBy: string;
  generatedAt: string;
  expiresAt?: string;
}

export interface WorkflowState {
  projectId: string;
  currentStage: WorkflowStage;
  stages: Record<WorkflowStage, StageState>;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export type WorkflowStage = 'plan' | 'ingest' | 'classify' | 'map' | 'model' | 'score' | 'review' | 'export';

export interface StageState {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
}

export interface ModelCall {
  id: string;
  projectId: string;
  stage: WorkflowStage;
  modelTier: 'small' | 'large' | 'medium' | 'embedding';
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface ConnectorScanResult {
  connectorId: string;
  objects: MetadataObject[];
  scannedAt: string;
  errors: ScanError[];
}

export interface ScanError {
  objectId?: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface IntentParseResult {
  requirements: Requirement[];
  entities: ExtractedEntity[];
  constraints: Constraint[];
  confidence: number;
}

export interface Requirement {
  id: string;
  description: string;
  type: 'data-point' | 'kpi' | 'hierarchy' | 'context' | 'integration';
  priority: 'required' | 'preferred' | 'optional';
  sourceHints?: string[];
}

export interface ExtractedEntity {
  name: string;
  type: string;
  attributes: string[];
  confidence: number;
}

export interface Constraint {
  type: 'residency' | 'latency' | 'format' | 'security' | 'compliance';
  value: string;
}

export interface ClassificationResult {
  objectId: string;
  category: 'production-count' | 'machine-state' | 'downtime-reason' | 'batch-context' | 'material' | 'order' | 'shift' | 'line' | 'kpi-component' | 'other';
  confidence: number;
  reasoning: string;
}

export interface MappingProposal {
  sourceObjectId: string;
  targetObjectId: string;
  transformation?: Transformation;
  confidence: number;
  evidence: Evidence[];
  reasoning: string;
}

export interface GapDetectionResult {
  gaps: Gap[];
  coverageScore: number;
}