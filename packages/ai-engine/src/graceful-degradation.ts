import type { ModelTier, ModelRequest, ModelResponse } from './types.js';
import { ModelRouterError } from '@connexy/shared';
import type { WorkersAIRunner } from './workers-ai-runner.js';

export interface DegradationConfig {
  maxRetries: number;
  retryDelayMs: number;
  fallbackToHeuristic: boolean;
  alertThreshold: number;
}

export type DegradationState = 'healthy' | 'degraded' | 'fallback';

export class GracefulDegradation {
  private state: DegradationState = 'healthy';
  private consecutiveFailures = 0;
  private totalCalls = 0;
  private totalFailures = 0;
  private config: DegradationConfig;
  private lastError: string | null = null;
  private recoveryAttempts = 0;

  constructor(config?: Partial<DegradationConfig>) {
    this.config = {
      maxRetries: 2,
      retryDelayMs: 500,
      fallbackToHeuristic: true,
      alertThreshold: 0.3,
      ...config,
    };
  }

  getState(): DegradationState {
    return this.state;
  }

  getHealth(): {
    state: DegradationState;
    consecutiveFailures: number;
    failureRate: number;
    totalCalls: number;
    lastError: string | null;
  } {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      failureRate: this.totalCalls > 0 ? this.totalFailures / this.totalCalls : 0,
      totalCalls: this.totalCalls,
      lastError: this.lastError,
    };
  }

  async callWithFallback<T>(
    runner: WorkersAIRunner,
    ai: Ai,
    request: ModelRequest,
    parseFn: (raw: string) => T,
    heuristicFallback?: () => T,
  ): Promise<ModelResponse<T>> {
    this.totalCalls++;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await runner.complete(ai, request, parseFn);
        this.onSuccess();
        return result;
      } catch (err) {
        lastErr = err;
        this.onFailure(err instanceof Error ? err.message : String(err));
        if (attempt < this.config.maxRetries) {
          await new Promise(r => setTimeout(r, this.config.retryDelayMs * (attempt + 1)));
        }
      }
    }

    if (this.config.fallbackToHeuristic && heuristicFallback) {
      this.state = 'fallback';
      const fallbackData = heuristicFallback();
      return {
        content: fallbackData,
        rawContent: '[heuristic fallback]',
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        modelTier: request.tier,
        modelName: 'heuristic-fallback',
        success: true,
        error: 'Model endpoint unavailable — using heuristic fallback',
      } as ModelResponse<T>;
    }

    throw new ModelRouterError(
      `Model endpoint unavailable after ${this.config.maxRetries + 1} attempts: ${this.lastError}`,
      request.tier,
      { consecutiveFailures: this.consecutiveFailures, lastError: this.lastError },
    );
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state === 'degraded' || this.state === 'fallback') {
      this.recoveryAttempts++;
      if (this.recoveryAttempts >= 3) {
        this.state = 'healthy';
        this.recoveryAttempts = 0;
      }
    }
  }

  private onFailure(error: string): void {
    this.consecutiveFailures++;
    this.totalFailures++;
    this.lastError = error;
    if (this.consecutiveFailures >= 3) {
      this.state = 'degraded';
    }
  }

  shouldAlert(): boolean {
    const failureRate = this.totalCalls > 0 ? this.totalFailures / this.totalCalls : 0;
    return failureRate > this.config.alertThreshold || this.state === 'fallback';
  }
}