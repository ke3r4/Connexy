import { ReadOnlyConnectorAdapter } from '../adapter.js';
import type { ReadOnlyScanResult, ConnectorManifest } from '../types.js';
import type { ConnectorConfig, MetadataObject } from '@connexy/shared';

const manifest: ConnectorManifest = {
  type: 'aveva-pi',
  displayName: 'AVEVA PI System (Historian)',
  tier: 'historian',
  supportsLiveAccess: false,
  version: '0.1.0',
  scope: ['read-pi-points', 'read-pi-tags', 'read-metadata'],
  capabilities: { canRead: true, canWrite: false, canStream: true, supportsBatch: true, supportsIncremental: true, maxObjectCount: 200000 },
  configSchema: { type: 'object', properties: { piServer: { type: 'string' }, dataArchive: { type: 'string' } } },
  defaultConfig: { readOnlyAssertion: true },
};

export class AvevaPiConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;

  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    const connectorId = config.connectorId as string || 'aveva-pi';
    const now = new Date().toISOString();
    const objects: MetadataObject[] = [
      {
        id: crypto.randomUUID(), connectorId, externalId: '\\\\PLANT\\LINE1.PRODUCTION_COUNT',
        name: 'LINE1.ProductionCount', type: 'tag', path: '\\\\PLANT\\LINE1',
        description: 'PI point for production count', dataType: 'Float32', unitOfMeasure: 'count',
        properties: { pointType: 'Float32', zeroCode: '0', instrumentTag: 'PLC.L1.COUNT' },
        lineage: [{ type: 'source', refId: 'pi-server' }], createdAt: now, updatedAt: now,
      },
      {
        id: crypto.randomUUID(), connectorId, externalId: '\\\\PLANT\\LINE1.MACHINE_STATE',
        name: 'LINE1.MachineState', type: 'tag', path: '\\\\PLANT\\LINE1',
        description: 'PI point for machine state', dataType: 'Int16',
        properties: { pointType: 'Int16', digitalStates: ['0=Off', '1=On', '2=Fault'] },
        lineage: [{ type: 'source', refId: 'pi-server' }], createdAt: now, updatedAt: now,
      },
      {
        id: crypto.randomUUID(), connectorId, externalId: '\\\\PLANT\\LINE1.DOWNTIME_REASON',
        name: 'LINE1.DowntimeReason', type: 'tag', path: '\\\\PLANT\\LINE1',
        description: 'PI point for downtime reason', dataType: 'String',
        properties: { pointType: 'String' },
        lineage: [{ type: 'source', refId: 'pi-server' }], createdAt: now, updatedAt: now,
      },
      {
        id: crypto.randomUUID(), connectorId, externalId: '\\\\PLANT\\LINE1.BATCH_ID',
        name: 'LINE1.BatchId', type: 'tag', path: '\\\\PLANT\\LINE1',
        description: 'PI point for batch ID', dataType: 'String',
        properties: { pointType: 'String' },
        lineage: [{ type: 'source', refId: 'pi-server' }], createdAt: now, updatedAt: now,
      },
    ];
    return { connectorId, objects, errors: [], scannedAt: now, objectCount: objects.length, readOnlyVerified: true };
  }

  async testScan(_config: ConnectorConfig): Promise<{ success: boolean; message: string; objectCount: number }> {
    return { success: true, message: 'AVEVA PI connector ready (fixture mode)', objectCount: 4 };
  }
}