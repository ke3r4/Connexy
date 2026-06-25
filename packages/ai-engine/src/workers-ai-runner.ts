import type { ModelRequest, ModelResponse, ModelTier } from './types.js';
import { ModelRouterError } from '@connexy/shared';
import type { ZodSchema } from 'zod';
import { StructuredOutputValidator } from './output-validator.js';

export interface WorkersAIConfig {
  smallModel: string;
  largeModel: string;
  mediumModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  largeModelCachedInputPrice: number;
  largeModelInputPrice: number;
  largeModelOutputPrice: number;
}

export const WORKERS_AI_CONFIG: WorkersAIConfig = {
  // Tier 1 — high-volume extraction/classification: Llama 3.1 8B Fast
  // Cheapest text-gen model on Workers AI; plenty capable for intent parse + tag classify
  smallModel: '@cf/meta/llama-3.1-8b-instruct-fast',
  // Tier 2 — mapping reasoning + semantic model generation: GLM-5.2
  // 262K context, reasoning, function calling, AND provider-side prompt caching
  // ($0.26/M cached input vs $1.40/M regular — 81% discount on repeated system prompts)
  // This directly solves the BRD's "no prompt caching for Mistral" concern
  largeModel: '@cf/zai-org/glm-5.2',
  largeModelCachedInputPrice: 0.26,   // per M tokens — cache hits
  largeModelInputPrice: 1.40,         // per M tokens — cache misses
  largeModelOutputPrice: 4.40,        // per M tokens
  // Tier 3 — escalation for genuinely ambiguous multi-step cases: Llama 3.3 70B fp8-fast
  // 70B with fp8 quantization for speed + batch; rare ceiling tier
  mediumModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  // Embeddings — metadata semantic search: BGE Large (1024-dim, batch-supported)
  embeddingModel: '@cf/baai/bge-large-en-v1.5',
  embeddingDimensions: 1024,
};

export interface WorkersAIRunnerBindings {
  AI: Ai;
}

interface WorkersAIChatResponse {
  response?: string;
  tool_calls?: unknown[];
}

interface WorkersAIEmbedResponse {
  shape?: number[];
  data?: number[][];
}

interface WorkersAIUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export class WorkersAIRunner {
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
  private config: WorkersAIConfig;
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

  constructor(config?: Partial<WorkersAIConfig>) {
    this.config = { ...WORKERS_AI_CONFIG, ...config };
  }

  getWorkerAIModel(tier: ModelTier): string {
    switch (tier) {
      case 'small': return this.config.smallModel;
      case 'large': return this.config.largeModel;
      case 'medium': return this.config.mediumModel;
      case 'embedding': return this.config.embeddingModel;
      default: return this.config.smallModel;
    }
  }

  async complete<T>(
    ai: Ai,
    request: ModelRequest,
    parseFn: (raw: string) => T,
  ): Promise<ModelResponse<T>> {
    const modelId = this.getWorkerAIModel(request.tier);
    const startTime = Date.now();

    // Check cost cap before making the call
    if (request.costCap && request.checkCostCap) {
      const estimatedPromptTokens = this.estimateTokens(request.systemPrompt + request.userPrompt);
      const estimatedCompletionTokens = request.maxTokens || 2048;
      const estimatedCost = this.computeWorkersAICost(request.tier, estimatedPromptTokens, estimatedCompletionTokens, 0.5);
      
      const capCheck = await request.checkCostCap(estimatedCost);
      if (!capCheck.allowed) {
        throw new ModelRouterError(
          `Cost cap exceeded: ${capCheck.reason || 'Project cost cap would be exceeded'}`,
          request.tier,
          { estimatedCost, capCheck },
        );
      }
    }

    try {
      const response = await ai.run(modelId, {
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        max_tokens: request.maxTokens || 2048,
        temperature: request.temperature ?? 0.2,
      }) as WorkersAIChatResponse & { usage?: WorkersAIUsage };

      const rawContent = response.response || '';
      if (!rawContent) {
        throw new ModelRouterError(
          `Workers AI returned empty response from ${modelId}`,
          request.tier,
        );
      }

      const content = parseFn(rawContent);
      const promptTokens = response.usage?.prompt_tokens ?? this.estimateTokens(request.systemPrompt + request.userPrompt);
      const completionTokens = response.usage?.completion_tokens ?? this.estimateTokens(rawContent);
      // GLM-5.2 prompt caching: system prompt is reused across calls, so it's
      // eligible for Cloudflare-side caching. Estimate cache ratio as the
      // proportion of tokens that come from the system prompt.
      const systemPromptTokens = this.estimateTokens(request.systemPrompt);
      const cacheHitRatio = promptTokens > 0 ? Math.min(systemPromptTokens / promptTokens, 0.8) : 0;
      const costUsd = this.computeWorkersAICost(request.tier, promptTokens, completionTokens, cacheHitRatio);
      const latencyMs = Date.now() - startTime;

      const result: ModelResponse<T> = {
        content,
        rawContent,
        promptTokens,
        completionTokens,
        costUsd,
        latencyMs,
        modelTier: request.tier,
        modelName: modelId,
        success: true,
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
      const error = err instanceof Error ? err.message : String(err);
      this.recordCost({
        projectId: request.projectId,
        modelTier: request.tier,
        modelName: modelId,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        latencyMs,
        success: false,
        stage: request.stage,
        timestamp: new Date().toISOString(),
      });
      if (err instanceof ModelRouterError) throw err;
      throw new ModelRouterError(
        `Workers AI call failed: ${error}`,
        request.tier,
        { modelId, originalError: error },
      );
    }
  }

  async completeWithSchema<T>(
    ai: Ai,
    request: ModelRequest,
    schema: ZodSchema<T>,
  ): Promise<ModelResponse<T>> {
    return this.complete(ai, request, (raw) => {
      const result = this.validator.repair(raw, schema);
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

  async embed(
    ai: Ai,
    texts: string[],
    metadata?: Record<string, unknown>[],
  ): Promise<{ vectors: number[][]; costUsd: number }> {
    const modelId = this.config.embeddingModel;
    const startTime = Date.now();

    try {
      const response = await ai.run(modelId, {
        text: texts,
      }) as WorkersAIEmbedResponse;

      const vectors = response.data || [];
      const tokenEstimate = texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
      const costUsd = this.computeWorkersAICost('embedding', tokenEstimate, 0);
      const latencyMs = Date.now() - startTime;

      this.recordCost({
        projectId: metadata?.[0]?.projectId as string || 'unknown',
        modelTier: 'embedding',
        modelName: modelId,
        promptTokens: tokenEstimate,
        completionTokens: 0,
        costUsd,
        latencyMs,
        success: true,
        stage: 'embed',
        timestamp: new Date().toISOString(),
      });

      return { vectors, costUsd };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      throw new ModelRouterError(
        `Workers AI embedding failed: ${error}`,
        'embedding',
        { modelId },
      );
    }
  }

  async embedAndStoreToVectorize(
    ai: Ai,
    vectorize: VectorizeIndex,
    texts: string[],
    projectId: string,
    tenantId: string,
    metadataList?: Record<string, unknown>[],
  ): Promise<{ stored: number; costUsd: number }> {
    const { vectors, costUsd } = await this.embed(ai, texts);

    const vectorsToUpsert = vectors.map((values, i) => ({
      id: crypto.randomUUID(),
      values,
      metadata: {
        ...(metadataList?.[i] || {}),
        projectId,
        tenantId,
        text: texts[i]?.substring(0, 1000),
      },
    }));

    await vectorize.upsert(vectorsToUpsert);

    return { stored: vectorsToUpsert.length, costUsd };
  }

  async semanticSearch(
    ai: Ai,
    vectorize: VectorizeIndex,
    query: string,
    projectId: string,
    topK: number = 10,
  ): Promise<{ matches: Array<{ id: string; score: number; metadata: Record<string, unknown> }> }> {
    const { vectors } = await this.embed(ai, [query]);
    if (vectors.length === 0) return { matches: [] };

    const results = await vectorize.query(vectors[0], {
      topK,
      filter: { projectId },
      returnMetadata: 'all',
    });

    return {
      matches: results.matches?.map(m => ({
        id: m.id,
        score: m.score,
        metadata: m.metadata || {},
      })) || [],
    };
  }

  computeWorkersAICost(
    tier: ModelTier,
    promptTokens: number,
    completionTokens: number,
    cacheHitRatio: number = 0,
  ): number {
    // Workers AI published pricing (per million tokens):
    //   GLM-5.2 (large):     $1.40 input, $0.26 cached input, $4.40 output
    //   Llama 3.1 8B (small): $0.10 input, $0.10 output
    //   Llama 3.3 70B (med):  $0.60 input, $0.60 output
    //   BGE Large (embed):    $0.05 input
    const costPerMTokens: Record<ModelTier, { input: number; cachedInput: number; output: number }> = {
      small:     { input: 0.10, cachedInput: 0.10, output: 0.10 },
      large:     { input: this.config.largeModelInputPrice, cachedInput: this.config.largeModelCachedInputPrice, output: this.config.largeModelOutputPrice },
      medium:    { input: 0.60, cachedInput: 0.60, output: 0.60 },
      embedding: { input: 0.05, cachedInput: 0.05, output: 0 },
    };
    const rates = costPerMTokens[tier];
    // GLM-5.2 prompt caching: system prompts are cached on Cloudflare's side,
    // so cacheHitRatio of promptTokens pay the cached rate (81% discount).
    // Default 0 (no cache) for safety; the workflow passes actual ratio.
    const cachedTokens = Math.floor(promptTokens * cacheHitRatio);
    const uncachedTokens = promptTokens - cachedTokens;
    const inputCost = (uncachedTokens / 1_000_000) * rates.input
                    + (cachedTokens / 1_000_000) * rates.cachedInput;
    const outputCost = (completionTokens / 1_000_000) * rates.output;
    return inputCost + outputCost;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private recordCost(record: {
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
  }): void {
    this.costRecords.push(record);
    this.onCostRecorded?.(record);
  }

  getCostRecords() {
    return [...this.costRecords];
  }

  getProjectCost(projectId: string): { totalCost: number; calls: number; byTier: Record<string, { cost: number; calls: number }> } {
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

export const workersAIRunner = new WorkersAIRunner();