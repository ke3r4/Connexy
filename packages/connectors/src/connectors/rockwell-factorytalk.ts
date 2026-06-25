import { ReadOnlyConnectorAdapter } from '../adapter.js';
import type { ReadOnlyScanResult, ConnectorManifest } from '../types.js';
import type { ConnectorConfig, MetadataObject } from '@connexy/shared';

const manifest: ConnectorManifest = {
  type: 'rockwell-factorytalk', displayName: 'Rockwell FactoryTalk', tier: 'mes',
  supportsLiveAccess: false, version: '0.1.0', scope: ['read-tags', 'read-alarms'],
  capabilities: { canRead: true, canWrite: false, canStream: true, supportsBatch: true, supportsIncremental: true, maxObjectCount: 100000 },
  configSchema: { type: 'object', properties: { baseUrl: { type: 'string' } } }, defaultConfig: { readOnlyAssertion: true },
};

export class RockwellFactoryTalkConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;
  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    const cid = (config as Record<string, string>).connectorId || 'rockwell-ft';
    const now = new Date().toISOString();
    const objects: MetadataObject[] = [
      { id: crypto.randomUUID(), connectorId: cid, externalId: '[Line1]ProductionCount', name: 'ProductionCount', type: 'tag', properties: { dataType: 'DINT', scope: 'Line1' }, lineage: [{ type: 'source', refId: 'factorytalk' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: '[Line1]MachineState', name: 'MachineState', type: 'tag', properties: { dataType: 'DINT', enum: ['0=Stopped', '1=Running', '2=Faulted'] }, lineage: [{ type: 'source', refId: 'factorytalk' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: '[Line1]DowntimeReason', name: 'DowntimeReason', type: 'tag', properties: { dataType: 'STRING' }, lineage: [{ type: 'source', refId: 'factorytalk' }], createdAt: now, updatedAt: now },
    ];
    return { connectorId: cid, objects, errors: [], scannedAt: now, objectCount: objects.length, readOnlyVerified: true };
  }
  async testScan(): Promise<{ success: boolean; message: string; objectCount: number }> {
    return { success: true, message: 'Rockwell FactoryTalk connector ready (fixture mode)', objectCount: 3 };
  }
}