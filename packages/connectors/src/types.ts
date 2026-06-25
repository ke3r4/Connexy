import type { MetadataObject, ConnectorConfig, ScanError } from '@connexy/shared';

export type ConnectorTier = 'erp' | 'mes' | 'historian' | 'scada' | 'machine' | 'file';

export interface ConnectorType {
  type: string;
  displayName: string;
  tier: ConnectorTier;
  supportsLiveAccess: boolean;
  defaultConfig: Record<string, unknown>;
}

export interface ReadOnlyScanResult {
  connectorId: string;
  objects: MetadataObject[];
  errors: ScanError[];
  scannedAt: string;
  objectCount: number;
  readOnlyVerified: boolean;
}

export interface ConnectorManifest {
  type: string;
  displayName: string;
  tier: ConnectorTier;
  version: string;
  scope: string[];
  capabilities: ConnectorCapabilities;
  configSchema: Record<string, unknown>;
  supportsLiveAccess: boolean;
  defaultConfig: Record<string, unknown>;
}

export interface ConnectorCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canStream: boolean;
  supportsBatch: boolean;
  supportsIncremental: boolean;
  maxObjectCount: number;
}