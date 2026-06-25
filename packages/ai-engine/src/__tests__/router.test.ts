import { describe, it, expect } from 'vitest';
import { ModelRouter } from '../router.js';
import { ConfidenceCalibrator } from '../confidence.js';

describe('ModelRouter', () => {
  it('computes cost correctly per tier', () => {
    const router = new ModelRouter();
    const smallCost = router.computeCost('small', 1_000_000, 500_000);
    expect(smallCost).toBeCloseTo(0.20 + 0.30, 2);
    const largeCost = router.computeCost('large', 1_000_000, 500_000);
    expect(largeCost).toBeCloseTo(2.00 + 3.00, 2);
  });

  it('asserts data residency violation', () => {
    const router = new ModelRouter();
    expect(() => router.assertResidency('us', 'small')).toThrow('Data residency');
    expect(() => router.assertResidency('eu', 'small')).not.toThrow();
    expect(() => router.assertResidency('custom', 'small')).not.toThrow();
  });

  it('tracks per-project cost', () => {
    const router = new ModelRouter();
    router['recordCost']({
      projectId: 'p1', modelTier: 'small', modelName: 'mistral-small',
      promptTokens: 1000000, completionTokens: 500000, costUsd: 0.50, latencyMs: 200,
      success: true, stage: 'classify', timestamp: new Date().toISOString(),
    });
    router['recordCost']({
      projectId: 'p1', modelTier: 'large', modelName: 'mistral-large',
      promptTokens: 500000, completionTokens: 200000, costUsd: 2.20, latencyMs: 1500,
      success: true, stage: 'map', timestamp: new Date().toISOString(),
    });
    const spend = router.getProjectCost('p1');
    expect(spend.totalCost).toBeCloseTo(2.70, 2);
    expect(spend.calls).toBe(2);
    expect(spend.byTier.small.calls).toBe(1);
    expect(spend.byTier.large.calls).toBe(1);
  });
});

describe('ConfidenceCalibrator', () => {
  it('returns raw confidence with insufficient history', () => {
    const cal = new ConfidenceCalibrator();
    expect(cal.calibrate(0.9)).toBe(0.9);
  });

  it('calibrates toward actual acceptance rate with history', () => {
    const cal = new ConfidenceCalibrator();
    for (let i = 0; i < 50; i++) {
      cal.record(0.9, true);
      cal.record(0.5, false);
    }
    const calibratedHigh = cal.calibrate(0.9);
    const calibratedMid = cal.calibrate(0.5);
    expect(calibratedHigh).toBeGreaterThan(0.5);
    expect(calibratedMid).toBeLessThan(0.5);
  });

  it('produces calibration report', () => {
    const cal = new ConfidenceCalibrator();
    cal.record(0.9, true);
    cal.record(0.8, false);
    cal.record(0.5, true);
    const report = cal.getCalibrationReport();
    expect(report.length).toBeGreaterThan(0);
    expect(report[0].bucket).toBeDefined();
  });
});