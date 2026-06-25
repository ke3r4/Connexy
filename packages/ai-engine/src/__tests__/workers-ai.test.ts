import { describe, it, expect, vi } from 'vitest';
import { WorkersAIRunner } from '../workers-ai-runner.js';
import { z } from 'zod';

const mockAI = {
  run: vi.fn(),
} as unknown as Ai;

describe('WorkersAIRunner — Cloudflare Workers AI (Mistral)', () => {
  it('uses the correct model per tier', () => {
    const runner = new WorkersAIRunner();
    expect(runner.getWorkerAIModel('small')).toBe('@cf/meta/llama-3.1-8b-instruct-fast');
    expect(runner.getWorkerAIModel('large')).toBe('@cf/zai-org/glm-5.2');
    expect(runner.getWorkerAIModel('medium')).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    expect(runner.getWorkerAIModel('embedding')).toBe('@cf/baai/bge-large-en-v1.5');
  });

  it('calls env.AI.run with the correct model and messages', async () => {
    const runner = new WorkersAIRunner();
    const mockResponse = {
      response: '{"requirements": [{"description": "production count", "type": "data-point", "priority": "required"}]}',
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };
    (mockAI.run as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await runner.complete(
      mockAI,
      {
        tier: 'small',
        systemPrompt: 'You are a classifier.',
        userPrompt: 'Classify: ProductionCount',
        projectId: 'p1',
        tenantId: 't1',
        stage: 'classify',
      },
      (raw) => JSON.parse(raw),
    );

    expect(mockAI.run).toHaveBeenCalledWith(
      '@cf/meta/llama-3.1-8b-instruct-fast',
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: 'You are a classifier.' }),
          expect.objectContaining({ role: 'user', content: 'Classify: ProductionCount' }),
        ]),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.content).toHaveProperty('requirements');
    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(50);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.modelName).toBe('@cf/meta/llama-3.1-8b-instruct-fast');
  });

  it('completeWithSchema validates and repairs output', async () => {
    const runner = new WorkersAIRunner();
    const mockResponse = {
      response: '```json\n{"result": "production-count", "confidence": 0.92}\n```',
      usage: { prompt_tokens: 50, completion_tokens: 20 },
    };
    (mockAI.run as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const schema = z.object({
      result: z.string(),
      confidence: z.number(),
    });

    const result = await runner.completeWithSchema(
      mockAI,
      {
        tier: 'small',
        systemPrompt: 'Return JSON.',
        userPrompt: 'Classify this.',
        projectId: 'p1',
        tenantId: 't1',
        stage: 'classify',
      },
      schema,
    );

    expect(result.content.result).toBe('production-count');
    expect(result.content.confidence).toBe(0.92);
  });

  it('records cost per project', async () => {
    const runner = new WorkersAIRunner();
    (mockAI.run as ReturnType<typeof vi.fn>).mockResolvedValue({
      response: '{"category": "other"}',
      usage: { prompt_tokens: 50, completion_tokens: 10 },
    });

    await runner.complete(mockAI, {
      tier: 'small', systemPrompt: 'test', userPrompt: 'test',
      projectId: 'cost-test', tenantId: 't1', stage: 'classify',
    }, (r) => JSON.parse(r));

    const spend = runner.getProjectCost('cost-test');
    expect(spend.calls).toBe(1);
    expect(spend.totalCost).toBeGreaterThan(0);
    expect(spend.byTier.small.calls).toBe(1);
  });

  it('handles AI errors gracefully', async () => {
    const runner = new WorkersAIRunner();
    (mockAI.run as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Model unavailable'));

    await expect(
      runner.complete(mockAI, {
        tier: 'small', systemPrompt: 'test', userPrompt: 'test',
        projectId: 'err-test', tenantId: 't1', stage: 'classify',
      }, (r) => JSON.parse(r)),
    ).rejects.toThrow('Workers AI call failed');
  });

  it('computes tiered cost — large (GLM-5.2) is more expensive than small (8B)', () => {
    const runner = new WorkersAIRunner();
    const smallCost = runner.computeWorkersAICost('small', 1_000_000, 500_000);
    const largeCost = runner.computeWorkersAICost('large', 1_000_000, 500_000);
    const mediumCost = runner.computeWorkersAICost('medium', 1_000_000, 500_000);
    const embedCost = runner.computeWorkersAICost('embedding', 1_000_000, 0);
    expect(smallCost).toBeLessThan(mediumCost);
    expect(mediumCost).toBeLessThan(largeCost);
    expect(embedCost).toBeLessThan(smallCost);
  });

  it('GLM-5.2 prompt caching reduces cost by ~81% on cached tokens', () => {
    const runner = new WorkersAIRunner();
    // 1M prompt tokens, 500K output, no cache
    const noCacheCost = runner.computeWorkersAICost('large', 1_000_000, 500_000, 0);
    // Same with 80% cache hit ratio (system prompt is reused)
    const withCacheCost = runner.computeWorkersAICost('large', 1_000_000, 500_000, 0.8);
    expect(withCacheCost).toBeLessThan(noCacheCost);
    // Savings should be substantial (>50% reduction on input portion)
    const savings = noCacheCost - withCacheCost;
    const inputCostNoCache = (1_000_000 / 1_000_000) * 1.40;
    expect(savings).toBeGreaterThan(inputCostNoCache * 0.5);
  });

  it('GLM-5.2 cost matches published pricing', () => {
    const runner = new WorkersAIRunner();
    // 1M input (no cache) + 1M output = $1.40 + $4.40 = $5.80
    const cost = runner.computeWorkersAICost('large', 1_000_000, 1_000_000, 0);
    expect(cost).toBeCloseTo(5.80, 2);
    // 1M cached input + 1M output = $0.26 + $4.40 = $4.66
    const cachedCost = runner.computeWorkersAICost('large', 1_000_000, 1_000_000, 1.0);
    expect(cachedCost).toBeCloseTo(4.66, 2);
  });

  it('embeds text via Workers AI', async () => {
    const runner = new WorkersAIRunner();
    (mockAI.run as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
      shape: [2, 3],
    });

    const result = await runner.embed(mockAI, ['hello', 'world']);
    expect(result.vectors).toHaveLength(2);
    expect(result.vectors[0]).toEqual([0.1, 0.2, 0.3]);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('getCostSummary provides aggregated metrics', async () => {
    const runner = new WorkersAIRunner();
    (mockAI.run as ReturnType<typeof vi.fn>).mockResolvedValue({
      response: '{"ok": true}',
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    await runner.complete(mockAI, {
      tier: 'small', systemPrompt: 't', userPrompt: 't',
      projectId: 'summary-test', tenantId: 't1', stage: 'map',
    }, (r) => JSON.parse(r));

    (mockAI.run as ReturnType<typeof vi.fn>).mockResolvedValue({
      response: '{"ok": true}',
      usage: { prompt_tokens: 200, completion_tokens: 100 },
    });

    await runner.complete(mockAI, {
      tier: 'large', systemPrompt: 't', userPrompt: 't',
      projectId: 'summary-test', tenantId: 't1', stage: 'map',
    }, (r) => JSON.parse(r));

    const summary = runner.getCostSummary();
    expect(summary.totalCalls).toBe(2);
    expect(summary.successRate).toBe(1.0);
    expect(summary.byTier.small.calls).toBe(1);
    expect(summary.byTier.large.calls).toBe(1);
  });
});