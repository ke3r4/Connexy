# Connexy — Connector Authoring Guide

## Overview
Connexy connectors are **read-only** adapters that extract metadata from source systems. They NEVER write to, modify, or control any source system (Prime Directive 1).

## Creating a Connector

### 1. Implement the Adapter
```typescript
import { ReadOnlyConnectorAdapter } from '@connexy/connectors';
import type { ReadOnlyScanResult, ConnectorManifest } from '@connexy/connectors';

const manifest: ConnectorManifest = {
  type: 'my-system',
  displayName: 'My Manufacturing System',
  tier: 'mes',
  supportsLiveAccess: false,
  version: '1.0.0',
  scope: ['read-objects', 'read-metadata'],
  capabilities: {
    canRead: true,
    canWrite: false,  // MANDATORY: must be false
    canStream: false,
    supportsBatch: true,
    supportsIncremental: true,
    maxObjectCount: 50000,
  },
  configSchema: { type: 'object', properties: { baseUrl: { type: 'string' } } },
  defaultConfig: { readOnlyAssertion: true },
};

export class MySystemConnector extends ReadOnlyConnectorAdapter {
  readonly manifest = manifest;

  async scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult> {
    this.assertConfigHasReadOnlyAssertion(config);
    // Your read-only metadata extraction logic here
    const objects: MetadataObject[] = [];
    return {
      connectorId: config.connectorId,
      objects,
      errors: [],
      scannedAt: new Date().toISOString(),
      objectCount: objects.length,
      readOnlyVerified: true,
    };
  }

  async testScan(config: ConnectorConfig): Promise<{ success: boolean; message: string; objectCount: number }> {
    this.assertConfigHasReadOnlyAssertion(config);
    return { success: true, message: 'Connection successful', objectCount: 0 };
  }
}
```

### 2. Register the Connector
```typescript
import { registry } from '@connexy/connectors';
import { MySystemConnector } from './my-system.js';

registry.register(new MySystemConnector());
```

## Rules
1. **`canWrite: false` is mandatory.** The registry will refuse to register a connector with `canWrite: true`.
2. **`readOnlyAssertion: true` is required** in every connector config. If absent, `scanReadOnly` throws.
3. **No write methods exist** on the adapter interface — only `scanReadOnly` and `testScan`.
4. **All scans are non-destructive.** They read metadata only, never modify source data.
5. **Fixtures for development.** If live API access is unavailable, build against fixtures per Prime Directive 8/9.

## Supported Tiers
- `erp` — Enterprise Resource Planning (SAP, Oracle, etc.)
- `mes` — Manufacturing Execution System (Opcenter, FactoryTalk, PAS-X, Tulip, Sepasoft)
- `historian` — Time-series data historian (AVEVA PI, Wonderware)
- `scada` — SCADA system (Ignition)
- `machine` — Machine/PLC interface (OPC UA, PLC tag exports)
- `file` — Structured metadata files (CSV, JSON, XML exports)

## v1 Connector Inventory
| Type | Tier | Status |
|---|---|---|
| metadata-file | file | Fixture |
| sap-erp | erp | Fixture |
| siemens-opcenter | mes | Fixture |
| aveva-pi | historian | Fixture |
| rockwell-factorytalk | mes | Fixture |
| werum-pasx | mes | Fixture |
| tulip | mes | Fixture |
| sepasoft | mes | Fixture |
| aveva-wonderware | historian | Fixture |
| ignition | scada | Fixture |
| opc-ua | machine | Fixture |
| plc-tags | machine | Fixture |