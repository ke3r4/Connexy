import { ReadOnlyConnectorAdapter } from '../adapter.js';
import type { ReadOnlyScanResult, ConnectorManifest } from '../types.js';
import type { ConnectorConfig, MetadataObject } from '@connexy/shared';

const manifest: ConnectorManifest = {
  type: 'plc-tags', displayName: 'PLC Tag Export', tier: 'machine',
  supportsLiveAccess: false, version: '0.1.0', scope: ['read-tag-list'],
  capabilities: { canRead: true, canWrite: false, canStream: false, supportsBatch: true, supportsIncremental: false, maxObjectCount: 10000 },
  configSchema: { type: 'object', properties: { filePath: { type: 'string' }, plcType: { type: 'string', enum: ['allen-bradley', 'siemens', 'mitsubishi'] } } }, defaultConfig: { readOnlyAssertion: true },
};

export class PlcTagsConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;
  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    const cid = (config as Record<string, string>).connectorId || 'plc-tags';
    const now = new Date().toISOString();
    const objects: MetadataObject[] = [
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'PLT_LINE_1.PRODUCTION_COUNT', name: 'ProductionCount', type: 'tag', properties: { dataType: 'DINT', address: 'N7:0' }, lineage: [{ type: 'source', refId: 'plc-export' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'PLT_LINE_1.MACHINE_STATE', name: 'MachineState', type: 'tag', properties: { dataType: 'DINT', address: 'N7:1' }, lineage: [{ type: 'source', refId: 'plc-export' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'PLT_LINE_1.DOWNTIME_REASON', name: 'DowntimeReason', type: 'tag', properties: { dataType: 'STRING', address: 'ST9:0' }, lineage: [{ type: 'source', refId: 'plc-export' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'PLT_LINE_1.BATCH_ID', name: 'BatchId', type: 'tag', properties: { dataType: 'STRING', address: 'ST9:1' }, lineage: [{ type: 'source', refId: 'plc-export' }], createdAt: now, updatedAt: now },
    ];
    return { connectorId: cid, objects, errors: [], scannedAt: now, objectCount: objects.length, readOnlyVerified: true };
  }
  async testScan(): Promise<{ success: boolean; message: string; objectCount: number }> {
    return { success: true, message: 'PLC tag export connector ready (fixture mode)', objectCount: 4 };
  }
}