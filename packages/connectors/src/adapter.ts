import type { ReadOnlyScanResult, ConnectorManifest, ConnectorCapabilities } from './types.js';
import type { ConnectorConfig } from '@connexy/shared';
import { ReadOnlyViolationError } from '@connexy/shared';

export abstract class ConnectorAdapter {
  abstract readonly manifest: ConnectorManifest;

  get capabilities(): ConnectorCapabilities {
    return this.manifest.capabilities;
  }

  get isReadOnly(): boolean {
    return this.manifest.capabilities.canRead && !this.manifest.capabilities.canWrite;
  }

  abstract scanReadOnly(config: ConnectorConfig): Promise<ReadOnlyScanResult>;

  abstract testScan(config: ConnectorConfig): Promise<{ success: boolean; message: string; objectCount: number }>;

  protected assertReadOnly(): void {
    if (!this.isReadOnly) {
      throw new ReadOnlyViolationError(
        `Connector ${this.manifest.type} does not declare read-only capability. Connexy only supports read-only connectors.`,
        { connectorType: this.manifest.type },
      );
    }
  }

  protected assertConfigHasReadOnlyAssertion(config: ConnectorConfig): void {
    if (config.readOnlyAssertion !== true) {
      throw new ReadOnlyViolationError(
        `Connector config must include readOnlyAssertion: true. Connexy never writes to source systems.`,
        { connectorType: this.manifest.type },
      );
    }
  }
}

export abstract class ReadOnlyConnectorAdapter extends ConnectorAdapter {
}