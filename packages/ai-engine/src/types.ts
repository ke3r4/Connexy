export type ModelTier = 'small' | 'large' | 'medium' | 'embedding';

export interface ModelConfig {
  tier: ModelTier;
  modelName: string;
  endpoint: string;
  apiKey: string;
  region: string;
  maxTokens: number;
  temperature: number;
  pricePerMTokenInput: number;
  pricePerMTokenOutput: number;
  hosting: 'cloud' | 'self-hosted';
}

export interface ModelRequest {
  tier: ModelTier;
  systemPrompt: string;
  userPrompt: string;
  responseSchema?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  projectId: string;
  tenantId: string;
  stage: string;
  metadataReuseKey?: string;
  costCap?: {
    projectPriceUsd?: number;
    capUsd?: number;
    capPercentage?: number;
  };
  checkCostCap?: (projectedCostUsd: number) => Promise<{ allowed: boolean; reason?: string }>;
}

export interface ModelResponse<T = unknown> {
  content: T;
  rawContent: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  modelTier: ModelTier;
  modelName: string;
  success: boolean;
  error?: string;
}

export interface ModelRouterConfig {
  models: Record<ModelTier, ModelConfig>;
  aiGatewayId?: string;
  defaultRegion: string;
  enableBatch: boolean;
  metadataReuseEnabled: boolean;
}

export interface CostRecord {
  projectId: string;
  modelTier: ModelTier;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  stage: string;
  timestamp: string;
}