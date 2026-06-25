import { ReadOnlyConnectorAdapter } from '../adapter.js';
import type { ReadOnlyScanResult, ConnectorManifest } from '../types.js';
import type { ConnectorConfig, MetadataObject } from '@connexy/shared';

const manifest: ConnectorManifest = {
  type: 'aveva-wonderware', displayName: 'AVEVA Wonderware (Historian/SCADA)', tier: 'historian',
  supportsLiveAccess: false, version: '0.1.0', scope: ['read-tags', 'read-alarms'],
  capabilities: { canRead: true, canWrite: false, canStream: true, supportsBatch: true, supportsIncremental: true, maxObjectCount: 150000 },
  configSchema: { type: 'object', properties: { serverName: { type: 'string' } } }, defaultConfig: { readOnlyAssertion: true },
};

export class AvevaWonderwareConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;
  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    const cid = (config as Record<string, string>).connectorId || 'aveva-ww';
    const now = new Date().toISOString();
    const objects: MetadataObject[] = [
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'Line1.ProductionCount', name: 'ProductionCount', type: 'tag', properties: { dataType: 'Integer' }, lineage: [{ type: 'source', refId: 'wonderware' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'Line1.MachineState', name: 'MachineState', type: 'tag', properties: { dataType: 'Integer', enum: ['0=Off', '1=On'] }, lineage: [{ type: 'source', refId: 'wonderware' }], createdAt: now, updatedAt: now },
    ];
    return { connectorId: cid, objects, errors: [], scannedAt: now, objectCount: objects.length, readOnlyVerified: true };
  }
  async testScan(): Promise<{ success: boolean; message: string; objectCount: number }> {
    return { success: true, message: 'AVEVA Wonderware connector ready (fixture mode)', objectCount: 2 };
  }
}