import type { ModelConfig, ModelTier, ModelRouterConfig, ModelRequest, ModelResponse, CostRecord } from './types.js';
import { ModelRouterError, DataResidencyError } from '@connexy/shared';
import { StructuredOutputValidator } from './output-validator.js';
import type { ZodSchema } from 'zod';

const validator = new StructuredOutputValidator();

const DEFAULT_CONFIG: ModelRouterConfig = {
  models: {
    small: {
      tier: 'small', modelName: 'mistral-small-latest', endpoint: 'https://api.mistral.ai/v1/chat/completions',
      apiKey: '', region: 'eu', maxTokens: 2048, temperature: 0.1,
      pricePerMTokenInput: 0.20, pricePerMTokenOutput: 0.60, hosting: 'cloud',
    },
    large: {
      tier: 'large', modelName: 'mistral-large-latest', endpoint: 'https://api.mistral.ai/v1/chat/completions',
      apiKey: '', region: 'eu', maxTokens: 4096, temperature: 0.2,
      pricePerMTokenInput: 2.00, pricePerMTokenOutput: 6.00, hosting: 'cloud',
    },
    medium: {
      tier: 'medium', modelName: 'mistral-medium-latest', endpoint: 'https://api.mistral.ai/v1/chat/completions',
      apiKey: '', region: 'eu', maxTokens: 8192, temperature: 0.3,
      pricePerMTokenInput: 2.70, pricePerMTokenOutput: 8.10, hosting: 'cloud',
    },
    embedding: {
      tier: 'embedding', modelName: 'mistral-embed', endpoint: 'https://api.mistral.ai/v1/embeddings',
      apiKey: '', region: 'eu', maxTokens: 8192, temperature: 0,
      pricePerMTokenInput: 0.12, pricePerMTokenOutput: 0, hosting: 'cloud',
    },
  },
  aiGatewayId: '',
  defaultRegion: 'eu',
  enableBatch: true,
  metadataReuseEnabled: true,
};

export class ModelRouter {
  private config: ModelRouterConfig;
  private metadataCache = new Map<string, unknown>();
  private costRecords: CostRecord[] = [];

  constructor(config?: Partial<ModelRouterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config, models: { ...DEFAULT_CONFIG.models, ...config?.models } };
  }

  setApiKey(key: string): void {
    for (const tier of Object.keys(this.config.models) as ModelTier[]) {
      this.config.models[tier].apiKey = key;
    }
  }

  setAiGatewayId(id: string): void {
    this.config.aiGatewayId = id;
  }

  assertResidency(tenantRegion: string, modelTier: ModelTier): void {
    const model = this.config.models[modelTier];
    if (tenantRegion !== 'custom' && tenantRegion !== model.region) {
      throw new DataResidencyError(
        `Data residency violation: tenant region (${tenantRegion}) != model region (${model.region})`,
        { tenantRegion, modelRegion: model.region, modelTier },
      );
    }
  }

  async complete<T>(request: ModelRequest, parseFn: (raw: string) => T): Promise<ModelResponse<T>> {
    const model = this.config.models[request.tier];
    const startTime = Date.now();
    if (this.config.metadataReuseEnabled && request.metadataReuseKey) {
      const cached = this.metadataCache.get(request.metadataReuseKey);
      if (cached) {
        return cached as ModelResponse<T>;
      }
    }
    const url = this.config.aiGatewayId
      ? `https://gateway.ai.cloudflare.com/v1/${this.config.aiGatewayId}/mistral/v1/chat/completions`
      : model.endpoint;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.apiKey}`,
    };
    const body: Record<string, unknown> = {
      model: model.modelName,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      max_tokens: request.maxTokens || model.maxTokens,
      temperature: request.temperature ?? model.temperature,
    };
    if (request.responseSchema) {
      body.response_format = { type: 'json_object', schema: request.responseSchema };
    }
    try {
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!response.ok) {
        const errorText = await response.text();
        throw new ModelRouterError(`Model API error (${response.status}): ${errorText}`, request.tier, { statusCode: response.status });
      }
      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
      };
      const rawContent = data.choices[0].message.content;
      const content = parseFn(rawContent);
      const promptTokens = data.usage.prompt_tokens;
      const completionTokens = data.usage.completion_tokens;
      const costUsd = this.computeCost(request.tier, promptTokens, completionTokens);
      const latencyMs = Date.now() - startTime;
      const result: ModelResponse<T> = {
        content, rawContent, promptTokens, completionTokens, costUsd, latencyMs,
        modelTier: request.tier, modelName: model.modelName, success: true,
      };
      if (this.config.metadataReuseEnabled && request.metadataReuseKey) {
        this.metadataCache.set(request.metadataReuseKey, result);
      }
      this.recordCost({ ...result, projectId: request.projectId, stage: request.stage, timestamp: new Date().toISOString() });
      return result;
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      this.recordCost({
        projectId: request.projectId, modelTier: request.tier, modelName: model.modelName,
        promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs, success: false,
        stage: request.stage, timestamp: new Date().toISOString(),
      });
      throw err;
    }
  }

  computeCost(tier: ModelTier, promptTokens: number, completionTokens: number): number {
    const model = this.config.models[tier];
    return (promptTokens / 1_000_000 * model.pricePerMTokenInput) + (completionTokens / 1_000_000 * model.pricePerMTokenOutput);
  }

  private recordCost(record: CostRecord): void {
    this.costRecords.push(record);
  }

  getCostRecords(): CostRecord[] {
    return [...this.costRecords];
  }

  getProjectCost(projectId: string): { totalCost: number; calls: number; byTier: Record<string, { cost: number; calls: number }> } {
    const projectRecords = this.costRecords.filter(r => r.projectId === projectId);
    const totalCost = projectRecords.reduce((sum, r) => sum + r.costUsd, 0);
    const byTier: Record<string, { cost: number; calls: number }> = {};
    for (const r of projectRecords) {
      if (!byTier[r.modelTier]) byTier[r.modelTier] = { cost: 0, calls: 0 };
      byTier[r.modelTier].cost += r.costUsd;
      byTier[r.modelTier].calls++;
    }
    return { totalCost, calls: projectRecords.length, byTier };
  }

  clearMetadataCache(): void {
    this.metadataCache.clear();
  }

  async completeWithSchema<T>(
    request: ModelRequest,
    schema: ZodSchema<T>,
  ): Promise<ModelResponse<T>> {
    return this.complete(request, (raw) => {
      const result = validator.repair(raw, schema);
      if (result.data === null) {
        throw new ModelRouterError(
          `Structured output validation failed after ${result.repairAttempts} repair attempts: ${result.errors.join('; ')}`,
          request.tier,
          { errors: result.errors, rawContent: raw.substring(0, 500) },
        );
      }
      return result.data;
    });
  }

  async batchComplete<T>(
    requests: ModelRequest[],
    parseFn: (raw: string) => T,
  ): Promise<ModelResponse<T>[]> {
    const results: ModelResponse<T>[] = [];
    for (const req of requests) {
      try {
        const result = await this.complete(req, parseFn);
        results.push(result);
      } catch (err) {
        const model = this.config.models[req.tier];
        results.push({
          content: null as T,
          rawContent: '',
          promptTokens: 0,
          completionTokens: 0,
          costUsd: 0,
          latencyMs: 0,
          modelTier: req.tier,
          modelName: model.modelName,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }

  getCostSummary(): {
    totalCost: number;
    totalCalls: number;
    successRate: number;
    byTier: Record<string, { cost: number; calls: number; successCount: number; avgLatencyMs: number }>;
  } {
    const records = this.costRecords;
    const totalCost = records.reduce((s, r) => s + r.costUsd, 0);
    const totalCalls = records.length;
    const successCount = records.filter(r => r.success).length;
    const byTier: Record<string, { cost: number; calls: number; successCount: number; avgLatencyMs: number }> = {};
    for (const r of records) {
      if (!byTier[r.modelTier]) byTier[r.modelTier] = { cost: 0, calls: 0, successCount: 0, avgLatencyMs: 0 };
      byTier[r.modelTier].cost += r.costUsd;
      byTier[r.modelTier].calls++;
      if (r.success) byTier[r.modelTier].successCount++;
      byTier[r.modelTier].avgLatencyMs += r.latencyMs;
    }
    for (const tier of Object.keys(byTier)) {
      byTier[tier].avgLatencyMs = byTier[tier].calls > 0 ? byTier[tier].avgLatencyMs / byTier[tier].calls : 0;
    }
    return {
      totalCost,
      totalCalls,
      successRate: totalCalls > 0 ? successCount / totalCalls : 0,
      byTier,
    };
  }
}

export const modelRouter = new ModelRouter();