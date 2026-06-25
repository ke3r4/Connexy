import { describe, it, expect, vi } from 'vitest';
import { SelfHostedRunner, UnifiedModelRunner } from '../self-hosted-runner.js';
import { WorkersAIRunner } from '../workers-ai-runner.js';
import { z } from 'zod';

describe('SelfHostedRunner — vLLM/SGLang/Ollama swap path', () => {
  it('uses the correct model per tier', () => {
    const runner = new SelfHostedRunner();
    expect(runner.getModelName('small')).toBe('ministral-8b-instruct');
    expect(runner.getModelName('large')).toBe('mistral-large-instruct');
    expect(runner.getModelName('medium')).toBe('mistral-medium-instruct');
    expect(runner.getModelName('embedding')).toBe('mistral-embed');
  });

  it('can set custom endpoint for VPC/on-prem', () => {
    const runner = new SelfHostedRunner();
    runner.setEndpoint('http://10.0.0.5:8080/v1/chat/completions');
    runner.setApiKey('my-vllm-key');
    expect(runner['config'].endpoint).toBe('http://10.0.0.5:8080/v1/chat/completions');
    expect(runner['config'].apiKey).toBe('my-vllm-key');
  });

  it('healthCheck returns unhealthy when endpoint is unreachable', async () => {
    const runner = new SelfHostedRunner({ healthCheckUrl: 'http://localhost:99999/health' });
    const result = await runner.healthCheck();
    expect(result.healthy).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('records cost as 0 for self-hosted (no per-token cost)', async () => {
    const runner = new SelfHostedRunner({ endpoint: 'http://localhost:99999/v1/chat/completions' });
    // Will fail but record a cost entry with costUsd: 0
    try {
      await runner.complete(
        { tier: 'small', systemPrompt: 'test', userPrompt: 'test',
          projectId: 'sh-cost', tenantId: 't1', stage: 'classify' },
        (r) => r,
      );
    } catch {
      // Expected to fail
    }
    const spend = runner.getProjectCost('sh-cost');
    expect(spend.totalCost).toBe(0);
  });
});

describe('UnifiedModelRunner — mode switching', () => {
  it('defaults to cloudflare mode', () => {
    const workersRunner = new WorkersAIRunner();
    const unified = new UnifiedModelRunner(workersRunner);
    expect(unified.getMode()).toBe('cloudflare');
  });

  it('switches to self-hosted mode', () => {
    const workersRunner = new WorkersAIRunner();
    const unified = new UnifiedModelRunner(workersRunner);
    unified.setMode('self-hosted');
    expect(unified.getMode()).toBe('self-hosted');
  });

  it('healthCheck returns healthy in cloudflare mode', async () => {
    const workersRunner = new WorkersAIRunner();
    const unified = new UnifiedModelRunner(workersRunner);
    const result = await unified.healthCheck();
    expect(result.healthy).toBe(true);
    expect(result.mode).toBe('cloudflare');
  });

  it('healthCheck returns unhealthy in self-hosted mode when endpoint unreachable', async () => {
    const workersRunner = new WorkersAIRunner();
    const unified = new UnifiedModelRunner(workersRunner, { healthCheckUrl: 'http://localhost:99999/health' });
    unified.setMode('self-hosted');
    const result = await unified.healthCheck();
    expect(result.healthy).toBe(false);
    expect(result.mode).toBe('self-hosted');
  });

  it('routes to self-hosted runner when in self-hosted mode', async () => {
    const workersRunner = new WorkersAIRunner();
    const unified = new UnifiedModelRunner(workersRunner, { endpoint: 'http://localhost:99999/v1/chat/completions' });
    unified.setMode('self-hosted');
    // Should fail with self-hosted error, not Workers AI error
    await expect(
      unified.complete(
        {} as Ai,
        { tier: 'small', systemPrompt: 't', userPrompt: 't', projectId: 'p1', tenantId: 't1', stage: 's' },
        (r) => r,
      ),
    ).rejects.toThrow('Self-hosted');
  });

  it('setCostCallback propagates to both runners', () => {
    const workersRunner = new WorkersAIRunner();
    const unified = new UnifiedModelRunner(workersRunner);
    const callback = vi.fn();
    unified.setCostCallback(callback);
    expect(workersRunner.onCostRecorded).toBe(callback);
    expect(unified.selfHostedRunner.onCostRecorded).toBe(callback);
  });
});