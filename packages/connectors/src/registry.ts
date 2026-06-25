import type { ConnectorAdapter } from './adapter.js';
import type { ConnectorType } from './types.js';

export class ConnectorRegistry {
  private adapters = new Map<string, ConnectorAdapter>();

  register(adapter: ConnectorAdapter): void {
    if (!adapter.isReadOnly) {
      throw new Error(`Cannot register connector ${adapter.manifest.type}: not read-only`);
    }
    if (adapter.manifest.capabilities.canWrite) {
      throw new Error(`Cannot register connector ${adapter.manifest.type}: write capability present — violates Prime Directive 1`);
    }
    this.adapters.set(adapter.manifest.type, adapter);
  }

  get(type: string): ConnectorAdapter | undefined {
    return this.adapters.get(type);
  }

  list(): ConnectorType[] {
    return Array.from(this.adapters.values()).map(a => ({
      type: a.manifest.type,
      displayName: a.manifest.displayName,
      tier: a.manifest.tier,
      supportsLiveAccess: a.manifest.supportsLiveAccess ?? false,
      defaultConfig: a.manifest.defaultConfig,
    }));
  }

  has(type: string): boolean {
    return this.adapters.has(type);
  }
}

export const registry = new ConnectorRegistry();