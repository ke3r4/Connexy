import { describe, it, expect } from 'vitest';
import { BatchProcessor } from '../batch-processor.js';

describe('BatchProcessor — Mistral batch API (50% off)', () => {
  it('applies 50% discount to batch cost', () => {
    const bp = new BatchProcessor();
    const result = bp.applyBatchDiscount(10.00);
    expect(result.original).toBe(10.00);
    expect(result.discounted).toBe(5.00);
    expect(result.savings).toBe(5.00);
  });

  it('chunks requests into batches of 50', () => {
    const bp = new BatchProcessor();
    const requests = Array.from({ length: 120 }, (_, i) => ({
      tier: 'small' as const,
      systemPrompt: 'test',
      userPrompt: `request ${i}`,
      projectId: 'p1',
      tenantId: 't1',
      stage: 'classify',
    }));
    const chunks = bp.chunkRequests(requests);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(50);
    expect(chunks[1]).toHaveLength(50);
    expect(chunks[2]).toHaveLength(20);
  });

  it('is batch eligible for non-interactive stages with 5+ requests', () => {
    const bp = new BatchProcessor();
    const classifyRequests = Array.from({ length: 10 }, () => ({
      tier: 'small' as const, systemPrompt: '', userPrompt: '',
      projectId: 'p1', tenantId: 't1', stage: 'classify',
    }));
    expect(bp.isBatchEligible(classifyRequests)).toBe(true);
  });

  it('is NOT batch eligible for interactive stages (plan, map)', () => {
    const bp = new BatchProcessor();
    const planRequests = Array.from({ length: 10 }, () => ({
      tier: 'small' as const, systemPrompt: '', userPrompt: '',
      projectId: 'p1', tenantId: 't1', stage: 'plan',
    }));
    expect(bp.isBatchEligible(planRequests)).toBe(false);
  });

  it('is NOT batch eligible for fewer than 5 requests', () => {
    const bp = new BatchProcessor();
    const fewRequests = Array.from({ length: 3 }, () => ({
      tier: 'small' as const, systemPrompt: '', userPrompt: '',
      projectId: 'p1', tenantId: 't1', stage: 'classify',
    }));
    expect(bp.isBatchEligible(fewRequests)).toBe(false);
  });

  it('projects savings for batch processing', () => {
    const bp = new BatchProcessor();
    const requests = Array.from({ length: 100 }, () => ({
      tier: 'small' as const, systemPrompt: '', userPrompt: '',
      projectId: 'p1', tenantId: 't1', stage: 'classify',
    }));
    const savings = bp.projectSavings(requests, 0.01);
    expect(savings.originalCost).toBe(1.00);
    expect(savings.batchCost).toBe(0.50);
    expect(savings.savings).toBe(0.50);
    expect(savings.savingsPercentage).toBe(50);
  });
});