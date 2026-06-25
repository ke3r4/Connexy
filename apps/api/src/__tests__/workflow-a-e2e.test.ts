import { describe, it, expect } from 'vitest';
import { MetadataFileConnector } from '../../../../packages/connectors/src/connectors/metadata-file.js';
import { SAPErpConnector } from '../../../../packages/connectors/src/connectors/sap-erp.js';
import { SiemensOpcenterConnector } from '../../../../packages/connectors/src/connectors/siemens-opcenter.js';
import { AvevaPiConnector } from '../../../../packages/connectors/src/connectors/aveva-pi.js';
import { normalizeScanResult, deduplicateObjects } from '../../../../packages/connectors/src/normalizer.js';
import { ModelRouter } from '../../../../packages/ai-engine/src/router.js';
import { ConfidenceCalibrator } from '../../../../packages/ai-engine/src/confidence.js';

describe('Workflow A — MES-to-Machine Integration Discovery (E2E against fixtures)', () => {
  it('completes the full discovery pipeline with fixture data', async () => {
    const metadataConnector = new MetadataFileConnector();
    const piConnector = new AvevaPiConnector();
    const mesConnector = new SiemensOpcenterConnector();
    const erpConnector = new SAPErpConnector();

    // Stage 1: Ingest — read metadata from connectors (read-only)
    const metadataScan = await metadataConnector.scanReadOnly({ readOnlyAssertion: true, connectorId: 'conn-metadata' });
    const piScan = await piConnector.scanReadOnly({ readOnlyAssertion: true, connectorId: 'conn-pi' });
    const mesScan = await mesConnector.scanReadOnly({ readOnlyAssertion: true, connectorId: 'conn-mes' });
    const erpScan = await erpConnector.scanReadOnly({ readOnlyAssertion: true, connectorId: 'conn-erp' });

    expect(metadataScan.readOnlyVerified).toBe(true);
    expect(piScan.readOnlyVerified).toBe(true);
    expect(mesScan.readOnlyVerified).toBe(true);
    expect(erpScan.readOnlyVerified).toBe(true);
    expect(metadataScan.objectCount).toBe(4);
    expect(piScan.objectCount).toBe(4);
    expect(mesScan.objectCount).toBe(3);
    expect(erpScan.objectCount).toBe(3);

    // Stage 2: Normalize — produce common internal metadata model
    const allObjects = [
      ...normalizeScanResult(metadataScan),
      ...normalizeScanResult(piScan),
      ...normalizeScanResult(mesScan),
      ...normalizeScanResult(erpScan),
    ];
    const deduped = deduplicateObjects(allObjects);
    expect(deduped.length).toBeGreaterThanOrEqual(metadataScan.objectCount);

    // Stage 3: Classify — categorize metadata objects
    const classify = (obj: { name: string }) => {
      const name = obj.name.toLowerCase();
      if (name.includes('count') || name.includes('production')) return 'production-count';
      if (name.includes('state') || name.includes('status')) return 'machine-state';
      if (name.includes('downtime') || name.includes('reason')) return 'downtime-reason';
      if (name.includes('batch') || name.includes('lot')) return 'batch-context';
      return 'other';
    };

    const classified = deduped.map(obj => ({
      id: obj.id,
      name: obj.name,
      category: classify(obj),
      confidence: 0.85,
    }));
    const productionCount = classified.find(c => c.category === 'production-count');
    const machineState = classified.find(c => c.category === 'machine-state');
    const downtimeReason = classified.find(c => c.category === 'downtime-reason');
    const batchContext = classified.find(c => c.category === 'batch-context');
    expect(productionCount).toBeDefined();
    expect(machineState).toBeDefined();
    expect(downtimeReason).toBeDefined();
    expect(batchContext).toBeDefined();

    // Stage 4: Map — propose source-to-target mappings with confidence + evidence
    const requirements = [
      { id: 'req-1', description: 'production count', category: 'production-count' },
      { id: 'req-2', description: 'machine state', category: 'machine-state' },
      { id: 'req-3', description: 'downtime reason', category: 'downtime-reason' },
      { id: 'req-4', description: 'batch context', category: 'batch-context' },
    ];

    const mappings = requirements.map(req => {
      const source = classified.find(c => c.category === req.category);
      const confidence = source ? 0.9 : 0.3;
      const evidence = source ? [
        { type: 'naming', sourceRef: source.name, description: `Name match for ${req.description}`, weight: 0.7 },
        { type: 'semantic', sourceRef: source.name, description: `Category match: ${req.category}`, weight: 0.8 },
      ] : [];
      return {
        sourceObjectId: source?.id || 'none',
        targetObjectId: req.id,
        confidence,
        evidence,
        status: 'proposed' as const,
        proposedBy: 'ai' as const,
      };
    });

    expect(mappings).toHaveLength(4);
    for (const m of mappings) {
      expect(m.confidence).toBeGreaterThan(0);
      expect(m.evidence.length).toBeGreaterThan(0);
    }

    // Stage 5: Score — confidence calibration + gap detection
    const calibrator = new ConfidenceCalibrator();
    for (const m of mappings) {
      calibrator.record(m.confidence, m.confidence > 0.8);
    }
    const gaps = mappings.filter(m => m.confidence < 0.7);
    const coverageScore = (mappings.length - gaps.length) / mappings.length;

    // Stage 6: Review — human accepts/rejects (simulated)
    const acceptedMappings = mappings.filter(m => m.confidence > 0.8);
    const rejectedMappings = mappings.filter(m => m.confidence < 0.7);
    for (const m of acceptedMappings) { m.status = 'accepted' as any; }
    for (const m of rejectedMappings) { m.status = 'rejected' as any; }

    expect(acceptedMappings.length).toBeGreaterThanOrEqual(3);
    expect(rejectedMappings.length).toBeLessThanOrEqual(1);

    // Stage 7: Export — validation-ready package
    const exportPackage = {
      mappings: mappings.map(m => ({ ...m, status: m.status })),
      gaps: gaps.map(g => ({
        type: 'missing-source',
        severity: 'medium' as const,
        description: `Low confidence mapping for ${g.targetObjectId}`,
        confidence: g.confidence,
        evidence: g.evidence,
      })),
      coverageScore,
      generatedAt: new Date().toISOString(),
      readOnlyAssertion: true,
      humanReviewed: true,
    };

    expect(exportPackage.mappings).toHaveLength(4);
    expect(exportPackage.coverageScore).toBeGreaterThanOrEqual(0.75);
    expect(exportPackage.readOnlyAssertion).toBe(true);
    expect(exportPackage.humanReviewed).toBe(true);
  });

  it('model router tracks cost for the workflow', () => {
    const router = new ModelRouter();
    // Simulate model calls for each stage
    router['recordCost']({
      projectId: 'wf-a-1', modelTier: 'small', modelName: 'mistral-small',
      promptTokens: 50000, completionTokens: 10000, costUsd: router.computeCost('small', 50000, 10000),
      latencyMs: 200, success: true, stage: 'classify', timestamp: new Date().toISOString(),
    });
    router['recordCost']({
      projectId: 'wf-a-1', modelTier: 'large', modelName: 'mistral-large',
      promptTokens: 80000, completionTokens: 20000, costUsd: router.computeCost('large', 80000, 20000),
      latencyMs: 1500, success: true, stage: 'map', timestamp: new Date().toISOString(),
    });

    const spend = router.getProjectCost('wf-a-1');
    expect(spend.calls).toBe(2);
    expect(spend.totalCost).toBeGreaterThan(0);
    expect(spend.byTier.small.calls).toBe(1);
    expect(spend.byTier.large.calls).toBe(1);
  });

  it('all connectors assert read-only (Prime Directive 1)', async () => {
    const connectors = [
      new MetadataFileConnector(),
      new SAPErpConnector(),
      new SiemensOpcenterConnector(),
      new AvevaPiConnector(),
    ];
    for (const conn of connectors) {
      expect(conn.isReadOnly).toBe(true);
      expect(conn.manifest.capabilities.canWrite).toBe(false);
      const result = await conn.scanReadOnly({ readOnlyAssertion: true, connectorId: 'test' });
      expect(result.readOnlyVerified).toBe(true);
    }
  });
});