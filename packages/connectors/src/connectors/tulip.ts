import { ReadOnlyConnectorAdapter } from '../adapter.js';
import type { ReadOnlyScanResult, ConnectorManifest } from '../types.js';
import type { ConnectorConfig, MetadataObject } from '@connexy/shared';

const manifest: ConnectorManifest = {
  type: 'tulip', displayName: 'Tulip (MES)', tier: 'mes',
  supportsLiveAccess: false, version: '0.1.0', scope: ['read-tables', 'read-records'],
  capabilities: { canRead: true, canWrite: false, canStream: true, supportsBatch: true, supportsIncremental: true, maxObjectCount: 50000 },
  configSchema: { type: 'object', properties: { apiKey: { type: 'string' } } }, defaultConfig: { readOnlyAssertion: true },
};

export class TulipConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;
  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    const cid = (config as Record<string, string>).connectorId || 'tulip';
    const now = new Date().toISOString();
    const objects: MetadataObject[] = [
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'ProductionLog', name: 'ProductionLog', type: 'table', properties: { fields: ['partNumber', 'quantity', 'stationId', 'timestamp'] }, lineage: [{ type: 'source', refId: 'tulip' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'DowntimeLog', name: 'DowntimeLog', type: 'table', properties: { fields: ['stationId', 'reason', 'duration', 'timestamp'] }, lineage: [{ type: 'source', refId: 'tulip' }], createdAt: now, updatedAt: now },
    ];
    return { connectorId: cid, objects, errors: [], scannedAt: now, objectCount: objects.length, readOnlyVerified: true };
  }
  async testScan(): Promise<{ success: boolean; message: string; objectCount: number }> {
    return { success: true, message: 'Tulip connector ready (fixture mode)', objectCount: 2 };
  }
}