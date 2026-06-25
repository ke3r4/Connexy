import { ReadOnlyConnectorAdapter } from '../adapter.js';
import type { ReadOnlyScanResult, ConnectorManifest } from '../types.js';
import type { ConnectorConfig, MetadataObject } from '@connexy/shared';

const manifest: ConnectorManifest = {
  type: 'ignition', displayName: 'Inductive Automation Ignition (SCADA)', tier: 'scada',
  supportsLiveAccess: false, version: '0.1.0', scope: ['read-tags', 'read-udts'],
  capabilities: { canRead: true, canWrite: false, canStream: true, supportsBatch: true, supportsIncremental: true, maxObjectCount: 200000 },
  configSchema: { type: 'object', properties: { gatewayUrl: { type: 'string' } } }, defaultConfig: { readOnlyAssertion: true },
};

export class IgnitionConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;
  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    const cid = (config as Record<string, string>).connectorId || 'ignition';
    const now = new Date().toISOString();
    const objects: MetadataObject[] = [
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'default:Line1/ProductionCount', name: 'ProductionCount', type: 'tag', path: 'Line1', properties: { dataType: 'Int4', tagPath: 'default:Line1/ProductionCount' }, lineage: [{ type: 'source', refId: 'ignition' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'default:Line1/MachineState', name: 'MachineState', type: 'tag', path: 'Line1', properties: { dataType: 'Int4', tagPath: 'default:Line1/MachineState' }, lineage: [{ type: 'source', refId: 'ignition' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'default:Line1/BatchId', name: 'BatchId', type: 'tag', path: 'Line1', properties: { dataType: 'String', tagPath: 'default:Line1/BatchId' }, lineage: [{ type: 'source', refId: 'ignition' }], createdAt: now, updatedAt: now },
    ];
    return { connectorId: cid, objects, errors: [], scannedAt: now, objectCount: objects.length, readOnlyVerified: true };
  }
  async testScan(): Promise<{ success: boolean; message: string; objectCount: number }> {
    return { success: true, message: 'Ignition connector ready (fixture mode)', objectCount: 3 };
  }
}