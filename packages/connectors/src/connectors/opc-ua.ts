import { ReadOnlyConnectorAdapter } from '../adapter.js';
import type { ReadOnlyScanResult, ConnectorManifest } from '../types.js';
import type { ConnectorConfig, MetadataObject } from '@connexy/shared';

const manifest: ConnectorManifest = {
  type: 'opc-ua', displayName: 'OPC UA (Machine Interface)', tier: 'machine',
  supportsLiveAccess: false, version: '0.1.0', scope: ['read-nodes', 'read-browse'],
  capabilities: { canRead: true, canWrite: false, canStream: true, supportsBatch: true, supportsIncremental: true, maxObjectCount: 300000 },
  configSchema: { type: 'object', properties: { endpointUrl: { type: 'string' }, securityMode: { type: 'string' } } }, defaultConfig: { readOnlyAssertion: true },
};

export class OpcUaConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;
  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    const cid = (config as Record<string, string>).connectorId || 'opc-ua';
    const now = new Date().toISOString();
    const objects: MetadataObject[] = [
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'ns=2;s=Line1.ProductionCount', name: 'ProductionCount', type: 'tag', path: 'ns=2', properties: { dataType: 'Int32', nodeId: 'ns=2;s=Line1.ProductionCount' }, lineage: [{ type: 'source', refId: 'opc-ua-server' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'ns=2;s=Line1.MachineState', name: 'MachineState', type: 'tag', path: 'ns=2', properties: { dataType: 'Int16', nodeId: 'ns=2;s=Line1.MachineState' }, lineage: [{ type: 'source', refId: 'opc-ua-server' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'ns=2;s=Line1.DowntimeReason', name: 'DowntimeReason', type: 'tag', path: 'ns=2', properties: { dataType: 'String', nodeId: 'ns=2;s=Line1.DowntimeReason' }, lineage: [{ type: 'source', refId: 'opc-ua-server' }], createdAt: now, updatedAt: now },
    ];
    return { connectorId: cid, objects, errors: [], scannedAt: now, objectCount: objects.length, readOnlyVerified: true };
  }
  async testScan(): Promise<{ success: boolean; message: string; objectCount: number }> {
    return { success: true, message: 'OPC UA connector ready (fixture mode)', objectCount: 3 };
  }
}