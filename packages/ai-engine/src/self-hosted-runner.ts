import type { ModelRequest, ModelResponse, ModelTier } from './types.js';
import { ModelRouterError } from '@connexy/shared';
import type { ZodSchema } from 'zod';
import { StructuredOutputValidator } from './output-validator.js';

export interface SelfHostedConfig {
  smallModel: string;
  largeModel: string;
  mediumModel: string;
  embeddingModel: string;
  endpoint: string;
  apiKey: string;
  healthCheckUrl: string;
}

export const DEFAULT_SELF_HOSTED_CONFIG: SelfHostedConfig = {
  smallModel: 'ministral-8b-instruct',
  largeModel: 'mistral-large-instruct',
  mediumModel: 'mistral-medium-instruct',
  embeddingModel: 'mistral-embed',
  endpoint: 'http://localhost:8080/v1/chat/completions',
  apiKey: 'not-needed',
  healthCheckUrl: 'http://localhost:8080/health',
};

interface OpenAIChatResponse {
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

interface OpenAIEmbedResponse {
  data: Array<{ embedding: number[] }>;
  usage: { total_tokens: number };
}

export class SelfHostedRunner {
  private validator = new StructuredOutputValidator();
  private costRecords: Array<{
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
  }> = [];
  private config: SelfHostedConfig;
  onCostRecorded?: (record: {
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
  }) => void;

  constructor(config?: Partial<SelfHostedConfig>) {
    this.config = { ...DEFAULT_SELF_HOSTED_CONFIG, ...config };
  }

  setEndpoint(url: string): void { this.config.endpoint = url; }
  setApiKey(key: string): void { this.config.apiKey = key; }
  setHealthCheckUrl(url: string): void { this.config.healthCheckUrl = url; }

  getModelName(tier: ModelTier): string {
    switch (tier) {
      case 'small': return this.config.smallModel;
      case 'large': return this.config.largeModel;
      case 'medium': return this.config.mediumModel;
      case 'embedding': return this.config.embeddingModel;
      default: return this.config.smallModel;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const resp = await fetch(this.config.healthCheckUrl, { signal: AbortSignal.timeout(5000) });
      const latencyMs = Date.now() - start;
      return { healthy: resp.ok, latencyMs };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async complete<T>(
    request: ModelRequest,
    parseFn: (raw: string) => T,
  ): Promise<ModelResponse<T>> {
    const modelName = this.getModelName(request.tier);
    const startTime = Date.now();

    // Check cost cap before making the call
    if (request.checkCostCap) {
      const estimatedCost = 0;
      const capCheck = await request.checkCostCap(estimatedCost);
      if (!capCheck.allowed) {
        throw new ModelRouterError(
          `Cost cap exceeded: ${capCheck.reason}`,
          request.tier,
          { capCheck },
        );
      }
    }

    try {
      const body: Record<string, unknown> = {
        model: modelName,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        max_tokens: request.maxTokens || 2048,
        temperature: request.temperature ?? 0.2,
      };

      if (request.responseSchema) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey !== 'not-needed' ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ModelRouterError(
          `Self-hosted model error (${response.status}): ${errorText}`,
          request.tier,
          { modelId: modelName, endpoint: this.config.endpoint },
        );
      }

      const data = await response.json() as OpenAIChatResponse;
      const rawContent = data.choices[0].message.content;
      if (!rawContent) {
        throw new ModelRouterError(`Empty response from ${modelName}`, request.tier);
      }

      const content = parseFn(rawContent);
      const promptTokens = data.usage?.prompt_tokens ?? this.estimateTokens(request.systemPrompt + request.userPrompt);
      const completionTokens = data.usage?.completion_tokens ?? this.estimateTokens(rawContent);
      const costUsd = 0; // Self-hosted: no per-token cost
      const latencyMs = Date.now() - startTime;

      const result: ModelResponse<T> = {
        content, rawContent, promptTokens, completionTokens,
        costUsd, latencyMs, modelTier: request.tier, modelName, success: true,
      };

      this.recordCost({
        ...result,
        projectId: request.projectId,
        stage: request.stage,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      this.recordCost({
        projectId: request.projectId, modelTier: request.tier, modelName,
        promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs,
        success: false, stage: request.stage, timestamp: new Date().toISOString(),
      });
      if (err instanceof ModelRouterError) throw err;
      throw new ModelRouterError(
        `Self-hosted call failed: ${err instanceof Error ? err.message : String(err)}`,
        request.tier,
        { modelId: modelName },
      );
    }
  }

  async completeWithSchema<T>(
    request: ModelRequest,
    schema: ZodSchema<T>,
  ): Promise<ModelResponse<T>> {
    return this.complete(request, (raw) => {
      const result = this.validator.repair(raw, schema);
      if (result.data === null) {
        throw new ModelRouterError(
          `Structured output validation failed: ${result.errors.join('; ')}`,
          request.tier,
        );
      }
      return result.data;
    });
  }

  async embed(texts: string[]): Promise<{ vectors: number[][]; costUsd: number }> {
    const start = Date.now();
    try {
      const response = await fetch(this.config.endpoint.replace('/chat/completions', '/embeddings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey !== 'not-needed' ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: this.config.embeddingModel, input: texts }),
      });
      if (!response.ok) throw new Error(`Embed error: ${response.status}`);
      const data = await response.json() as OpenAIEmbedResponse;
      return { vectors: data.data.map(d => d.embedding), costUsd: 0 };
    } catch (err) {
      throw new ModelRouterError(
        `Self-hosted embedding failed: ${err instanceof Error ? err.message : String(err)}`,
        'embedding',
      );
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private recordCost(record: {
    projectId: string; modelTier: ModelTier; modelName: string;
    promptTokens: number; completionTokens: number; costUsd: number;
    latencyMs: number; success: boolean; stage: string; timestamp: string;
  }): void {
    this.costRecords.push(record);
    this.onCostRecorded?.(record);
  }

  getProjectCost(projectId: string) {
    const records = this.costRecords.filter(r => r.projectId === projectId);
    const totalCost = records.reduce((s, r) => s + r.costUsd, 0);
    const byTier: Record<string, { cost: number; calls: number }> = {};
    for (const r of records) {
      if (!byTier[r.modelTier]) byTier[r.modelTier] = { cost: 0, calls: 0 };
      byTier[r.modelTier].cost += r.costUsd;
      byTier[r.modelTier].calls++;
    }
    return { totalCost, calls: records.length, byTier };
  }

  getCostSummary() {
    const records = this.costRecords;
    const totalCost = records.reduce((s, r) => s + r.costUsd, 0);
    const totalCalls = records.length;
    const successCount = records.filter(r => r.success).length;
    return { totalCost, totalCalls, successRate: totalCalls > 0 ? successCount / totalCalls : 0 };
  }
}

export class UnifiedModelRunner {
  private workersRunner: WorkersAIRunner;
  private selfHostedRunner: SelfHostedRunner;
  private mode: 'cloudflare' | 'self-hosted' = 'cloudflare';

  constructor(workersRunner: WorkersAIRunner, selfHostedConfig?: Partial<SelfHostedConfig>) {
    this.workersRunner = workersRunner;
    this.selfHostedRunner = new SelfHostedRunner(selfHostedConfig);
  }

  setMode(mode: 'cloudflare' | 'self-hosted'): void {
    this.mode = mode;
  }

  getMode(): 'cloudflare' | 'self-hosted' {
    return this.mode;
  }

  setSelfHostedEndpoint(url: string): void {
    this.selfHostedRunner.setEndpoint(url);
  }

  setSelfHostedApiKey(key: string): void {
    this.selfHostedRunner.setApiKey(key);
  }

  async healthCheck(): Promise<{ healthy: boolean; mode: string; latencyMs: number; error?: string }> {
    if (this.mode === 'self-hosted') {
      const result = await this.selfHostedRunner.healthCheck();
      return { ...result, mode: this.mode };
    }
    return { healthy: true, mode: this.mode, latencyMs: 0 };
  }

  async complete<T>(
    ai: Ai,
    request: ModelRequest,
    parseFn: (raw: string) => T,
  ): Promise<ModelResponse<T>> {
    if (this.mode === 'self-hosted') {
      return this.selfHostedRunner.complete(request, parseFn);
    }
    return this.workersRunner.complete(ai, request, parseFn);
  }

  async completeWithSchema<T>(
    ai: Ai,
    request: ModelRequest,
    schema: ZodSchema<T>,
  ): Promise<ModelResponse<T>> {
    if (this.mode === 'self-hosted') {
      return this.selfHostedRunner.completeWithSchema(request, schema);
    }
    return this.workersRunner.completeWithSchema(ai, request, schema);
  }

  async embed(
    ai: Ai,
    texts: string[],
  ): Promise<{ vectors: number[][]; costUsd: number }> {
    if (this.mode === 'self-hosted') {
      return this.selfHostedRunner.embed(texts);
    }
    // Use WorkersAIRunner's embed method
    const result = await this.workersRunner.embed(ai, texts);
    return result;
  }

  setCostCallback(callback: (record: {
    projectId: string; modelTier: ModelTier; modelName: string;
    promptTokens: number; completionTokens: number; costUsd: number;
    latencyMs: number; success: boolean; stage: string; timestamp: string;
  }) => void): void {
    this.workersRunner.onCostRecorded = callback;
    this.selfHostedRunner.onCostRecorded = callback;
  }

  getProjectCost(projectId: string) {
    if (this.mode === 'self-hosted') {
      return this.selfHostedRunner.getProjectCost(projectId);
    }
    return this.workersRunner.getProjectCost(projectId);
  }
}