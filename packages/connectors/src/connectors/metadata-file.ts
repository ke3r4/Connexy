import { ReadOnlyConnectorAdapter } from '../adapter.js';
import type { ReadOnlyScanResult, ConnectorManifest } from '../types.js';
import type { ConnectorConfig, MetadataObject } from '@connexy/shared';

const manifest: ConnectorManifest = {
  type: 'metadata-file',
  displayName: 'Structured Metadata File',
  tier: 'file',
  supportsLiveAccess: false,
  version: '1.0.0',
  scope: ['read-metadata', 'read-tags', 'read-fields'],
  capabilities: {
    canRead: true,
    canWrite: false,
    canStream: false,
    supportsBatch: true,
    supportsIncremental: false,
    maxObjectCount: 50000,
  },
  configSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string' },
      format: { type: 'string', enum: ['json', 'csv', 'xml'] },
    },
  },
  defaultConfig: {
    readOnlyAssertion: true,
    format: 'json',
  },
};

export class MetadataFileConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;

  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    const connectorId = config.connectorId as string || 'metadata-file';
    const objects: MetadataObject[] = this.getFixtureObjects(connectorId);
    return {
      connectorId,
      objects,
      errors: [],
      scannedAt: new Date().toISOString(),
      objectCount: objects.length,
      readOnlyVerified: true,
    };
  }

  async testScan(config: ConnectorConfig): Promise<{ success: boolean; message: string; objectCount: number }> {
    this.assertConfigHasReadOnlyAssertion(config);
    return { success: true, message: 'Metadata file connector ready (fixture mode)', objectCount: 4 };
  }

  private getFixtureObjects(connectorId: string): MetadataObject[] {
    const now = new Date().toISOString();
    return [
      {
        id: crypto.randomUUID(),
        connectorId,
        externalId: 'PLT_LINE_1.PRODUCTION_COUNT',
        name: 'ProductionCount',
        type: 'tag',
        path: 'PLT_LINE_1',
        description: 'Total production count for packaging line 1',
        dataType: 'INT',
        unitOfMeasure: 'count',
        sampleValues: [0, 1200, 2400],
        properties: { source: 'PLC tag export', dataType: 'INT', pollingRate: '1s' },
        lineage: [{ type: 'source', refId: 'plc-line-1' }],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        connectorId,
        externalId: 'PLT_LINE_1.MACHINE_STATE',
        name: 'MachineState',
        type: 'tag',
        path: 'PLT_LINE_1',
        description: 'Machine state enum: 0=Idle, 1=Run, 2=Fault, 3=Setup',
        dataType: 'INT',
        sampleValues: [0, 1, 2],
        properties: { source: 'PLC tag export', enum: ['0=Idle', '1=Run', '2=Fault', '3=Setup'] },
        lineage: [{ type: 'source', refId: 'plc-line-1' }],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        connectorId,
        externalId: 'PLT_LINE_1.DOWNTIME_REASON',
        name: 'DowntimeReason',
        type: 'tag',
        path: 'PLT_LINE_1',
        description: 'Downtime reason code',
        dataType: 'STRING',
        sampleValues: ['', 'CHANGEOVER', 'MAINTENANCE', 'MATERIAL_SHORTAGE'],
        properties: { source: 'PLC tag export' },
        lineage: [{ type: 'source', refId: 'plc-line-1' }],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        connectorId,
        externalId: 'PLT_LINE_1.BATCH_ID',
        name: 'BatchId',
        type: 'tag',
        path: 'PLT_LINE_1',
        description: 'Current batch identifier',
        dataType: 'STRING',
        sampleValues: ['BATCH-001', 'BATCH-002'],
        properties: { source: 'PLC tag export' },
        lineage: [{ type: 'source', refId: 'plc-line-1' }],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}