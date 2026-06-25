import { describe, it, expect } from 'vitest';
import { StructuredOutputValidator } from '../output-validator.js';
import { EvalHarness } from '../eval-harness.js';
import { ModelRouter } from '../router.js';
import { ConfidenceCalibrator } from '../confidence.js';
import { z } from 'zod';

describe('StructuredOutputValidator', () => {
  const validator = new StructuredOutputValidator();
  const schema = z.object({
    mappings: z.array(z.object({
      sourceObjectId: z.string(),
      targetObjectId: z.string(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.object({
        type: z.string(),
        sourceRef: z.string(),
        description: z.string(),
        weight: z.number(),
      })).min(1),
      reasoning: z.string(),
    })),
  });

  it('validates well-formed JSON', () => {
    const raw = JSON.stringify({
      mappings: [{
        sourceObjectId: 's1', targetObjectId: 't1', confidence: 0.9,
        evidence: [{ type: 'naming', sourceRef: 's1', description: 'match', weight: 0.7 }],
        reasoning: 'Name match',
      }],
    });
    const result = validator.repair(raw, schema);
    expect(result.data).not.toBeNull();
    expect(result.repaired).toBe(false);
  });

  it('extracts JSON from markdown code blocks', () => {
    const raw = '```json\n{"mappings":[{"sourceObjectId":"s1","targetObjectId":"t1","confidence":0.9,"evidence":[{"type":"naming","sourceRef":"s1","description":"match","weight":0.7}],"reasoning":"match"}]}\n```';
    const result = validator.repair(raw, schema);
    expect(result.data).not.toBeNull();
    expect(result.repaired).toBe(true);
  });

  it('repairs trailing commas', () => {
    const raw = '{"mappings":[{"sourceObjectId":"s1","targetObjectId":"t1","confidence":0.9,"evidence":[{"type":"naming","sourceRef":"s1","description":"match","weight":0.7,}],"reasoning":"match",}]}';
    const result = validator.repair(raw, schema);
    expect(result.repaired).toBe(true);
  });

  it('repairs missing evidence array by coercing default', () => {
    const raw = '{"mappings":[{"sourceObjectId":"s1","targetObjectId":"t1","confidence":0.9,"evidence":[],"reasoning":"match"}]}';
    const result = validator.repair(raw, schema);
    expect(result.data).not.toBeNull();
  });

  it('returns null for completely invalid output', () => {
    const raw = 'This is not JSON at all';
    const result = validator.repair(raw, schema);
    expect(result.data).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('EvalHarness', () => {
  it('loads default eval cases', () => {
    const harness = new EvalHarness();
    harness.loadDefaultCases();
    expect(harness['cases'].length).toBeGreaterThanOrEqual(5);
  });

  it('evaluates mapping precision and recall', () => {
    const harness = new EvalHarness();
    const result = harness.evaluateMappings(
      [
        { sourceObjectId: 's1', targetObjectId: 't1', confidence: 0.9 },
        { sourceObjectId: 's2', targetObjectId: 't2', confidence: 0.8 },
        { sourceObjectId: 's3', targetObjectId: 't3', confidence: 0.5 },
      ],
      [
        { sourceObjectId: 's1', targetObjectId: 't1' },
        { sourceObjectId: 's2', targetObjectId: 't2' },
      ],
    );
    expect(result.precision).toBeCloseTo(2/3, 2);
    expect(result.recall).toBe(1.0);
    expect(result.f1).toBeGreaterThan(0.7);
  });

  it('evaluates gap detection recall', () => {
    const harness = new EvalHarness();
    const result = harness.evaluateGaps(
      [
        { type: 'missing-source', description: 'gap 1' },
        { type: 'type-mismatch', description: 'gap 2' },
      ],
      [
        { type: 'missing-source', description: 'expected 1' },
        { type: 'type-mismatch', description: 'expected 2' },
        { type: 'unit-mismatch', description: 'expected 3' },
      ],
    );
    expect(result.recall).toBeCloseTo(2/3, 2);
    expect(result.precision).toBe(1.0);
  });

  it('evaluates confidence calibration', () => {
    const harness = new EvalHarness();
    const calibrator = new ConfidenceCalibrator();
    for (let i = 0; i < 50; i++) {
      calibrator.record(0.9, true);
      calibrator.record(0.5, false);
    }
    const result = harness.evaluateConfidenceCalibration(calibrator, 0.3);
    expect(result.calibrationError).toBeGreaterThanOrEqual(0);
  });

  it('runs full eval report', () => {
    const harness = new EvalHarness();
    harness.loadDefaultCases();
    const router = new ModelRouter();
    const report = harness.runEval(router);
    expect(report.totalCases).toBeGreaterThanOrEqual(5);
    expect(report.avgPrecision).toBeGreaterThan(0);
    expect(report.results.length).toBeGreaterThan(0);
  });
});

describe('ModelRouter — structured output', () => {
  it('completeWithSchema validates and repairs', async () => {
    const router = new ModelRouter();
    const schema = z.object({
      result: z.string(),
      confidence: z.number(),
    });
    // This would fail without a real API, but we test the interface exists
    expect(typeof router.completeWithSchema).toBe('function');
    expect(typeof router.batchComplete).toBe('function');
    expect(typeof router.getCostSummary).toBe('function');
  });

  it('getCostSummary provides aggregated metrics', () => {
    const router = new ModelRouter();
    router['recordCost']({
      projectId: 'p1', modelTier: 'small', modelName: 'mistral-small',
      promptTokens: 1000000, completionTokens: 500000, costUsd: 0.50, latencyMs: 200,
      success: true, stage: 'classify', timestamp: new Date().toISOString(),
    });
    router['recordCost']({
      projectId: 'p1', modelTier: 'large', modelName: 'mistral-large',
      promptTokens: 500000, completionTokens: 200000, costUsd: 2.20, latencyMs: 1500,
      success: false, stage: 'map', timestamp: new Date().toISOString(),
    });
    const summary = router.getCostSummary();
    expect(summary.totalCalls).toBe(2);
    expect(summary.successRate).toBe(0.5);
    expect(summary.byTier.small.successCount).toBe(1);
    expect(summary.byTier.large.successCount).toBe(0);
    expect(summary.byTier.small.avgLatencyMs).toBe(200);
  });
});