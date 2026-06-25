import { z } from 'zod';

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  dataResidencyRegion: z.enum(['eu', 'us', 'custom']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(['admin', 'architect', 'engineer', 'reviewer', 'viewer']),
  ssoSubject: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  workflowType: z.enum(['mes-to-machine', 'kpi-dashboard']),
  intent: z.string().min(1).max(5000),
  status: z.enum(['draft', 'running', 'review', 'approved', 'exported', 'archived']),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ConnectorTypeSchema = z.enum([
  'sap-erp', 'siemens-opcenter', 'rockwell-factorytalk', 'werum-pasx',
  'tulip', 'sepasoft', 'aveva-pi', 'aveva-wonderware', 'ignition',
  'opc-ua', 'plc-tags', 'metadata-file',
]);

export const ConnectorSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  type: ConnectorTypeSchema,
  name: z.string().min(1).max(255),
  config: z.object({
    baseUrl: z.string().url().optional(),
    scope: z.array(z.string()).optional(),
    readOnlyAssertion: z.boolean().default(true),
    testScan: z.boolean().default(true),
  }).passthrough(),
  credentialsRef: z.string(),
  status: z.enum(['configured', 'validated', 'syncing', 'error', 'disabled']),
  lastSyncAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const EvidenceSchema = z.object({
  type: z.enum(['metadata', 'sample', 'naming', 'semantic', 'lineage', 'human']),
  sourceRef: z.string(),
  description: z.string(),
  weight: z.number().min(0).max(1),
});

export const TransformationSchema = z.object({
  type: z.enum(['direct', 'expression', 'lookup', 'aggregation', 'concat', 'conditional']),
  expression: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
});

export const MappingSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  sourceObjectId: z.string().uuid(),
  targetObjectId: z.string().uuid(),
  transformation: TransformationSchema.optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema),
  status: z.enum(['proposed', 'accepted', 'rejected', 'modified']),
  proposedBy: z.enum(['ai', 'human']),
  reviewedBy: z.string().uuid().optional(),
  reviewedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const MappingProposalSchema = z.object({
  sourceObjectId: z.string().uuid(),
  targetObjectId: z.string().uuid(),
  transformation: TransformationSchema.optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema).min(1),
  reasoning: z.string().min(1),
});

export const GapSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  type: z.enum([
    'missing-source', 'missing-target', 'type-mismatch', 'unit-mismatch',
    'cardinality', 'hierarchy-gap', 'kpi-definition',
  ]),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string().min(1),
  affectedObjects: z.array(z.string().uuid()),
  recommendation: z.string().optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema),
  status: z.enum(['open', 'acknowledged', 'resolved', 'wont-fix']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProvenanceSchema = z.object({
  proposedBy: z.enum(['ai', 'human']),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(EvidenceSchema),
  acceptedAt: z.string().datetime().optional(),
  acceptedBy: z.string().uuid().optional(),
});

export const SemanticAttributeSchema = z.object({
  name: z.string().min(1),
  dataType: z.string().min(1),
  isKey: z.boolean().optional(),
  isNullable: z.boolean().optional(),
  description: z.string().optional(),
  sourceMappingId: z.string().uuid().optional(),
});

export const SemanticEntitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['fact', 'dimension', 'measure', 'kpi', 'hierarchy']),
  description: z.string().optional(),
  sourceMappings: z.array(z.string().uuid()),
  attributes: z.array(SemanticAttributeSchema),
  provenance: ProvenanceSchema,
});

export const SemanticRelationshipSchema = z.object({
  id: z.string().uuid(),
  fromEntityId: z.string().uuid(),
  toEntityId: z.string().uuid(),
  type: z.enum(['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many']),
  fromAttribute: z.string(),
  toAttribute: z.string(),
  provenance: ProvenanceSchema,
});

export const SemanticModelSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1),
  version: z.number().int().min(1),
  entities: z.array(SemanticEntitySchema),
  relationships: z.array(SemanticRelationshipSchema),
  status: z.enum(['draft', 'review', 'approved', 'published']),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const AuditEntrySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  before: z.record(z.unknown()).optional(),
  after: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
  hash: z.string().min(1),
});

export const WorkflowStageSchema = z.enum([
  'plan', 'ingest', 'classify', 'map', 'model', 'score', 'review', 'export',
]);

export const StageStateSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  error: z.string().optional(),
  output: z.record(z.unknown()).optional(),
});

export const WorkflowStateSchema = z.object({
  projectId: z.string().uuid(),
  currentStage: WorkflowStageSchema,
  stages: z.record(WorkflowStageSchema, StageStateSchema),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  error: z.string().optional(),
});

export const ModelCallSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  stage: WorkflowStageSchema,
  modelTier: z.enum(['small', 'large', 'medium', 'embedding']),
  modelName: z.string(),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  costUsd: z.number().min(0),
  latencyMs: z.number().int().min(0),
  success: z.boolean(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const IntentParseResultSchema = z.object({
  requirements: z.array(z.object({
    id: z.string(),
    description: z.string(),
    type: z.enum(['data-point', 'kpi', 'hierarchy', 'context', 'integration']),
    priority: z.enum(['required', 'preferred', 'optional']),
    sourceHints: z.array(z.string()).optional(),
  })),
  entities: z.array(z.object({
    name: z.string(),
    type: z.string(),
    attributes: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  })),
  constraints: z.array(z.object({
    type: z.enum(['residency', 'latency', 'format', 'security', 'compliance']),
    value: z.string(),
  })),
  confidence: z.number().min(0).max(1),
});

export const ClassificationResultSchema = z.object({
  objectId: z.string().uuid(),
  category: z.enum([
    'production-count', 'machine-state', 'downtime-reason', 'batch-context',
    'material', 'order', 'shift', 'line', 'kpi-component', 'other',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const GapDetectionResultSchema = z.object({
  gaps: z.array(GapSchema),
  coverageScore: z.number().min(0).max(1),
});

export const ExportPackageSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  type: z.enum(['mapping-spec', 'semantic-model', 'gap-report', 'validation-dossier', 'full']),
  format: z.enum(['json', 'yaml', 'xlsx', 'pdf']),
  r2Key: z.string(),
  status: z.enum(['generating', 'ready', 'failed']),
  generatedBy: z.string().uuid(),
  generatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export type TypeOf<T extends z.ZodTypeAny> = z.infer<T>;