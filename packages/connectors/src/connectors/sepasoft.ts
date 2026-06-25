import { ReadOnlyConnectorAdapter } from '../adapter.js';
import type { ReadOnlyScanResult, ConnectorManifest } from '../types.js';
import type { ConnectorConfig, MetadataObject } from '@connexy/shared';

const manifest: ConnectorManifest = {
  type: 'sepasoft', displayName: 'Sepasoft (MES for Ignition)', tier: 'mes',
  supportsLiveAccess: false, version: '0.1.0', scope: ['read-equipment', 'read-production'],
  capabilities: { canRead: true, canWrite: false, canStream: true, supportsBatch: true, supportsIncremental: true, maxObjectCount: 60000 },
  configSchema: { type: 'object', properties: { baseUrl: { type: 'string' } } }, defaultConfig: { readOnlyAssertion: true },
};

export class SepasoftConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;
  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    const cid = (config as Record<string, string>).connectorId || 'sepasoft';
    const now = new Date().toISOString();
    const objects: MetadataObject[] = [
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'EquipmentDefinition', name: 'EquipmentDefinition', type: 'entity', properties: { fields: ['Name', 'Path', 'EquipmentClass'] }, lineage: [{ type: 'source', refId: 'sepasoft' }], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), connectorId: cid, externalId: 'ProductionRun', name: 'ProductionRun', type: 'entity', properties: { fields: ['Name', 'Material', 'StartTime', 'EndTime', 'Status'] }, lineage: [{ type: 'source', refId: 'sepasoft' }], createdAt: now, updatedAt: now },
    ];
    return { connectorId: cid, objects, errors: [], scannedAt: now, objectCount: objects.length, readOnlyVerified: true };
  }
  async testScan(): Promise<{ success: boolean; message: string; objectCount: number }> {
    return { success: true, message: 'Sepasoft connector ready (fixture mode)', objectCount: 2 };
  }
}