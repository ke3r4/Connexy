import { ReadOnlyConnectorAdapter } from '../adapter.js';
import type { ReadOnlyScanResult, ConnectorManifest } from '../types.js';
import type { ConnectorConfig, MetadataObject } from '@connexy/shared';

const manifest: ConnectorManifest = {
  type: 'siemens-opcenter',
  displayName: 'Siemens Opcenter (formerly Camstar)',
  tier: 'mes',
  supportsLiveAccess: false,
  version: '0.1.0',
  scope: ['read-objects', 'read-history', 'read-specs'],
  capabilities: { canRead: true, canWrite: false, canStream: false, supportsBatch: true, supportsIncremental: true, maxObjectCount: 80000 },
  configSchema: { type: 'object', properties: { baseUrl: { type: 'string' } } },
  defaultConfig: { readOnlyAssertion: true },
};

export class SiemensOpcenterConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;

  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    const connectorId = config.connectorId as string || 'siemens-opcenter';
    const now = new Date().toISOString();
    const objects: MetadataObject[] = [
      {
        id: crypto.randomUUID(), connectorId, externalId: 'ProductionRun',
        name: 'ProductionRun', type: 'entity', description: 'MES production run object',
        properties: { fields: ['ContainerName', 'ProductName', 'Quantity', 'StartTime', 'EndTime', 'Status'] },
        lineage: [{ type: 'source', refId: 'opcenter' }], createdAt: now, updatedAt: now,
      },
      {
        id: crypto.randomUUID(), connectorId, externalId: 'EquipmentHistory',
        name: 'EquipmentHistory', type: 'entity', description: 'MES equipment history',
        properties: { fields: ['EquipmentName', 'State', 'ReasonCode', 'Timestamp'] },
        lineage: [{ type: 'source', refId: 'opcenter' }], createdAt: now, updatedAt: now,
      },
      {
        id: crypto.randomUUID(), connectorId, externalId: 'BatchRecord',
        name: 'BatchRecord', type: 'entity', description: 'MES batch record',
        properties: { fields: ['BatchId', 'Material', 'Quantity', 'ContainerName'] },
        lineage: [{ type: 'source', refId: 'opcenter' }], createdAt: now, updatedAt: now,
      },
    ];
    return { connectorId, objects, errors: [], scannedAt: now, objectCount: objects.length, readOnlyVerified: true };
  }

  async testScan(_config: ConnectorConfig): Promise<{ success: boolean; message: string; objectCount: number }> {
    return { success: true, message: 'Siemens Opcenter connector ready (fixture mode)', objectCount: 3 };
  }
}