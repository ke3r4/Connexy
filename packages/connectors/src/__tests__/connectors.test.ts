import { describe, it, expect } from 'vitest';
import { MetadataFileConnector } from '../connectors/metadata-file.js';
import { normalizeScanResult, deduplicateObjects } from '../normalizer.js';

describe('MetadataFileConnector', () => {
  const connector = new MetadataFileConnector();

  it('returns 4 fixture objects for packaging line scenario', async () => {
    const result = await connector.scanReadOnly({ readOnlyAssertion: true, connectorId: 'test-1' });
    expect(result.objectCount).toBe(4);
    expect(result.objects.map(o => o.name)).toContain('ProductionCount');
    expect(result.objects.map(o => o.name)).toContain('MachineState');
    expect(result.objects.map(o => o.name)).toContain('DowntimeReason');
    expect(result.objects.map(o => o.name)).toContain('BatchId');
  });

  it('all objects have source lineage', async () => {
    const result = await connector.scanReadOnly({ readOnlyAssertion: true, connectorId: 'test-2' });
    for (const obj of result.objects) {
      expect(obj.lineage).toBeDefined();
      expect(obj.lineage.length).toBeGreaterThan(0);
    }
  });

  it('testScan returns success', async () => {
    const result = await connector.testScan({ readOnlyAssertion: true });
    expect(result.success).toBe(true);
  });
});

describe('Normalizer', () => {
  it('deduplicates objects by connectorId + externalId', () => {
    const connector = new MetadataFileConnector();
    return connector.scanReadOnly({ readOnlyAssertion: true, connectorId: 'c1' }).then(result => {
      const duped = [...result.objects, ...result.objects];
      const deduped = deduplicateObjects(duped);
      expect(deduped.length).toBe(result.objects.length);
    });
  });

  it('normalizeScanResult adds connector metadata to properties', async () => {
    const connector = new MetadataFileConnector();
    const result = await connector.scanReadOnly({ readOnlyAssertion: true, connectorId: 'c2' });
    const normalized = normalizeScanResult(result);
    for (const obj of normalized) {
      expect(obj.properties._readOnlyVerified).toBe(true);
      expect(obj.properties._scannedAt).toBeDefined();
    }
  });
});