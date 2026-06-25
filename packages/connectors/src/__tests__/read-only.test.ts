import { describe, it, expect } from 'vitest';
import { MetadataFileConnector } from '../connectors/metadata-file.js';
import { SAPErpConnector } from '../connectors/sap-erp.js';
import { SiemensOpcenterConnector } from '../connectors/siemens-opcenter.js';
import { AvevaPiConnector } from '../connectors/aveva-pi.js';
import { RockwellFactoryTalkConnector } from '../connectors/rockwell-factorytalk.js';
import { WerumPasxConnector } from '../connectors/werum-pasx.js';
import { TulipConnector } from '../connectors/tulip.js';
import { SepasoftConnector } from '../connectors/sepasoft.js';
import { AvevaWonderwareConnector } from '../connectors/aveva-wonderware.js';
import { IgnitionConnector } from '../connectors/ignition.js';
import { OpcUaConnector } from '../connectors/opc-ua.js';
import { PlcTagsConnector } from '../connectors/plc-tags.js';
import { ReadOnlyConnectorAdapter } from '../adapter.js';
import { registry } from '../registry.js';

registry.register(new MetadataFileConnector());
registry.register(new SAPErpConnector());
registry.register(new SiemensOpcenterConnector());
registry.register(new AvevaPiConnector());
registry.register(new RockwellFactoryTalkConnector());
registry.register(new WerumPasxConnector());
registry.register(new TulipConnector());
registry.register(new SepasoftConnector());
registry.register(new AvevaWonderwareConnector());
registry.register(new IgnitionConnector());
registry.register(new OpcUaConnector());
registry.register(new PlcTagsConnector());

describe('Read-Only Safety Suite (Prime Directive 1)', () => {
  const connectorTypes = ['metadata-file', 'sap-erp', 'siemens-opcenter', 'aveva-pi', 'rockwell-factorytalk', 'werum-pasx', 'tulip', 'sepasoft', 'aveva-wonderware', 'ignition', 'opc-ua', 'plc-tags'];

  it.each(connectorTypes)('connector %s has canWrite: false', (type) => {
    const adapter = registry.get(type)!;
    expect(adapter.manifest.capabilities.canWrite).toBe(false);
  });

  it.each(connectorTypes)('connector %s has canRead: true', (type) => {
    const adapter = registry.get(type)!;
    expect(adapter.manifest.capabilities.canRead).toBe(true);
  });

  it.each(connectorTypes)('connector %s isReadOnly returns true', (type) => {
    const adapter = registry.get(type)!;
    expect(adapter.isReadOnly).toBe(true);
  });

  it.each(connectorTypes)('connector %s scanReadOnly returns readOnlyVerified: true', async (type) => {
    const adapter = registry.get(type)!;
    const result = await adapter.scanReadOnly({ readOnlyAssertion: true, connectorId: 'test-conn' });
    expect(result.readOnlyVerified).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it.each(connectorTypes)('connector %s rejects config without readOnlyAssertion', async (type) => {
    const adapter = registry.get(type)!;
    await expect(
      adapter.scanReadOnly({ readOnlyAssertion: false } as any),
    ).rejects.toThrow('readOnlyAssertion');
  });

  it('registry refuses to register a connector with canWrite: true', () => {
    const fakeManifest = {
      type: 'evil-connector', displayName: 'Evil', tier: 'file' as const,
      supportsLiveAccess: false, version: '1.0', scope: [],
      capabilities: { canRead: true, canWrite: true, canStream: false, supportsBatch: false, supportsIncremental: false, maxObjectCount: 1 },
      configSchema: {}, defaultConfig: {},
    };
    expect(() => {
      class FakeConnector extends ReadOnlyConnectorAdapter {
        readonly manifest = fakeManifest;
        async scanReadOnly() { return {} as any; }
        async testScan() { return { success: true, message: '', objectCount: 0 }; }
      }
      registry.register(new FakeConnector());
    }).toThrow();
  });
});