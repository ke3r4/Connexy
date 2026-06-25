import { ReadOnlyConnectorAdapter } from '../adapter.js';
import type { ReadOnlyScanResult, ConnectorManifest } from '../types.js';
import type { ConnectorConfig, MetadataObject } from '@connexy/shared';

const manifest: ConnectorManifest = {
  type: 'werum-pasx', displayName: 'Werum PAS-X (MES)', tier: 'mes',
  supportsLiveAccess: false, version: '0.1.0', scope: ['read-objects', 'read-batch-records'],
  capabilities: { canRead: true, canWrite: false, canStream: false, supportsBatch: true, supportsIncremental: true, maxObjectCount: 80000 },
  configSchema: { type: 'object', properties: { baseUrl: { type: 'string' } } }, defaultConfig: { readOnlyAssertion: true },
};

export class WerumPasxConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;
  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    const cid = (config as Record<string, string>).connectorId || 'werum-pasx';
    const now = new Date().toISOString();
    const objects: MetadataObject[] = [
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'BatchRecord', name: 'BatchRecord', type: 'entity', properties: { fields: ['BatchId', 'Material', 'StartDate', 'EndDate', 'Status'] }, lineage: [{ type: 'source', refId: 'pasx' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'EquipmentState', name: 'EquipmentState', type: 'entity', properties: { fields: ['Equipment', 'State', 'Timestamp', 'Reason'] }, lineage: [{ type: 'source', refId: 'pasx' }], createdAt: now, updatedAt: now },
    ];
    return { connectorId: cid, objects, errors: [], scannedAt: now, objectCount: objects.length, readOnlyVerified: true };
  }
  async testScan(): Promise<{ success: boolean; message: string; objectCount: number }> {
    return { success: true, message: 'Werum PAS-X connector ready (fixture mode)', objectCount: 2 };
  }
}