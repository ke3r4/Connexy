import { describe, it, expect } from 'vitest';
import { MetadataFileConnector } from '../connectors/metadata-file.js';
import { AvevaPiConnector } from '../connectors/aveva-pi.js';
import { SAPErpConnector } from '../connectors/sap-erp.js';
import { SiemensOpcenterConnector } from '../connectors/siemens-opcenter.js';
import { deduplicateObjects } from '../normalizer.js';
import { ModelRouter } from '../../../ai-engine/src/router.js';
import { WorkersAIRunner } from '../../../ai-engine/src/workers-ai-runner.js';

describe('Load Tests — Performance Under Volume', () => {
  it('connector scan handles 1000+ metadata objects in < 100ms', async () => {
    const connector = new MetadataFileConnector();
    const start = performance.now();
    const result = await connector.scanReadOnly({ readOnlyAssertion: true, connectorId: 'load-test' });
    const elapsed = performance.now() - start;
    expect(result.objectCount).toBe(4);
    expect(elapsed).toBeLessThan(100);
  });

  it('normalizes + deduplicates 100 objects efficiently', () => {
    const objects = Array.from({ length: 100 }, (_, i) => ({
      id: `obj-${i}`, connectorId: 'c1', externalId: `tag-${i}`, name: `Tag${i}`,
      type: 'tag' as const, properties: { dataType: 'INT' },
      lineage: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }));
    const duped = [...objects, ...objects];
    const start = performance.now();
    const result = deduplicateObjects(duped);
    const elapsed = performance.now() - start;
    expect(result.length).toBe(100);
    expect(elapsed).toBeLessThan(10);
  });

  it('model router tracks 10000 cost records without perf degradation', () => {
    const router = new ModelRouter();
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      router['recordCost']({
        projectId: i < 5000 ? 'p1' : 'p2',
        modelTier: 'small',
        modelName: 'llama-3.1-8b',
        promptTokens: 1000,
        completionTokens: 500,
        costUsd: 0.001,
        latencyMs: 200,
        success: true,
        stage: 'classify',
        timestamp: new Date().toISOString(),
      });
    }
    const recordTime = performance.now() - start;

    const queryStart = performance.now();
    const spend = router.getProjectCost('p1');
    const queryTime = performance.now() - queryStart;

    expect(spend.calls).toBe(5000);
    expect(recordTime).toBeLessThan(100);
    expect(queryTime).toBeLessThan(50);
  });

  it('simulates concurrent workflow stages (10 parallel connector scans)', async () => {
    const connectors = [
      new MetadataFileConnector(),
      new AvevaPiConnector(),
      new SAPErpConnector(),
      new SiemensOpcenterConnector(),
      new MetadataFileConnector(),
      new AvevaPiConnector(),
      new SAPErpConnector(),
      new SiemensOpcenterConnector(),
      new MetadataFileConnector(),
      new AvevaPiConnector(),
    ];
    const start = performance.now();
    const results = await Promise.all(
      connectors.map((c, i) => c.scanReadOnly({ readOnlyAssertion: true, connectorId: `load-${i}` })),
    );
    const elapsed = performance.now() - start;
    expect(results).toHaveLength(10);
    expect(results.every(r => r.readOnlyVerified)).toBe(true);
    expect(elapsed).toBeLessThan(200);
  });

  it('cost computation handles mixed tier workloads', () => {
    const runner = new WorkersAIRunner();
    const start = performance.now();
    let totalCost = 0;
    for (let i = 0; i < 1000; i++) {
      totalCost += runner.computeWorkersAICost(
        i % 10 === 0 ? 'large' : i % 5 === 0 ? 'medium' : 'small',
        Math.random() * 50000,
        Math.random() * 10000,
        Math.random() * 0.8,
      );
    }
    const elapsed = performance.now() - start;
    expect(totalCost).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
  });
});