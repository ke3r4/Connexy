import type { MetadataObject } from '@connexy/shared';
import type { ReadOnlyScanResult } from './types.js';

export function normalizeScanResult(result: ReadOnlyScanResult): MetadataObject[] {
  return result.objects.map(obj => ({
    ...obj,
    properties: {
      ...obj.properties,
      _connectorType: result.connectorId,
      _scannedAt: result.scannedAt,
      _readOnlyVerified: result.readOnlyVerified,
    },
  }));
}

export function deduplicateObjects(objects: MetadataObject[]): MetadataObject[] {
  const seen = new Map<string, MetadataObject>();
  for (const obj of objects) {
    const key = `${obj.connectorId}:${obj.externalId}`;
    if (!seen.has(key)) {
      seen.set(key, obj);
    }
  }
  return Array.from(seen.values());
}

export function indexByPath(objects: MetadataObject[]): Map<string, MetadataObject[]> {
  const index = new Map<string, MetadataObject[]>();
  for (const obj of objects) {
    const path = obj.path || 'root';
    if (!index.has(path)) index.set(path, []);
    index.get(path)!.push(obj);
  }
  return index;
}