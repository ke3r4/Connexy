import { describe, it, expect } from 'vitest';

// Minimal mock of DurableObject for testing
class DurableObject {
  ctx: { storage: MapStorage };
  constructor(ctx: { storage: MapStorage }) {
    this.ctx = ctx;
  }
}

class MapStorage {
  private data = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }
  async put(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }
  async list<T>(opts?: { prefix?: string }): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    for (const [key, value] of this.data) {
      if (!opts?.prefix || key.startsWith(opts.prefix)) {
        result.set(key, value as T);
      }
    }
    return result;
  }
}

// Inline the AuditLogDO logic for testing (avoids Cloudflare-specific import)
class TestAuditLogDO extends DurableObject {
  private async getChainHead(): Promise<string | null> {
    const head = await this.ctx.storage.get<string>('chain:head');
    return head || null;
  }

  private async computeHash(record: Record<string, unknown>): Promise<string> {
    const data = JSON.stringify({ ...record, prevHash: await this.getChainHead() });
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/audit') {
      const body = await request.json() as Record<string, unknown>;
      const id = (body.id as string) || crypto.randomUUID();
      const timestamp = (body.timestamp as string) || new Date().toISOString();
      const prevHash = await this.getChainHead();
      const record: Record<string, unknown> = {
        ...body, id, timestamp, prevHash, hash: '',
      };
      record.hash = await this.computeHash(record);
      const key = `audit:${timestamp}:${id}`;
      await this.ctx.storage.put(key, record);
      await this.ctx.storage.put('chain:head', record.hash);
      return Response.json({ id, hash: record.hash, prevHash });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/audit/')) {
      const entityId = url.pathname.split('/')[2];
      const entries: Record<string, unknown>[] = [];
      const map = await this.ctx.storage.list({ prefix: 'audit:' });
      for (const [, value] of map) {
        if ((value as Record<string, unknown>).entityId === entityId) {
          entries.push(value as Record<string, unknown>);
        }
      }
      entries.sort((a, b) => (a.timestamp as string).localeCompare(b.timestamp as string));
      return Response.json({ entityId, entries });
    }

    if (request.method === 'GET' && url.pathname === '/verify') {
      const map = await this.ctx.storage.list({ prefix: 'audit:' });
      const entries = Array.from(map.entries()).sort(([, a], [, b]) =>
        (a as Record<string, string>).timestamp.localeCompare((b as Record<string, string>).timestamp),
      );
      let prevHash: string | null = null;
      let valid = true;
      for (const [, record] of entries) {
        const rec = record as Record<string, unknown>;
        if (rec.prevHash !== prevHash) {
          valid = false;
        }
        prevHash = rec.hash as string;
      }
      return Response.json({ valid, count: entries.length });
    }

    return new Response('Not found', { status: 404 });
  }
}

function createRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`https://internal${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('AuditLogDO — Chain Integrity (Prime Directive 4)', () => {
  it('creates hash-chained entries', async () => {
    const doInstance = new TestAuditLogDO({ storage: new MapStorage() });
    const entry1 = {
      id: crypto.randomUUID(), tenantId: 't1', action: 'mapping.accept',
      entityType: 'mapping', entityId: 'map-1', timestamp: new Date().toISOString(),
    };
    const entry2 = {
      id: crypto.randomUUID(), tenantId: 't1', action: 'mapping.reject',
      entityType: 'mapping', entityId: 'map-2', timestamp: new Date().toISOString(),
    };

    const resp1 = await doInstance.fetch(createRequest('POST', '/audit', entry1));
    const result1 = await resp1.json();
    expect(result1.hash).toBeDefined();
    expect(result1.prevHash).toBeNull();

    const resp2 = await doInstance.fetch(createRequest('POST', '/audit', entry2));
    const result2 = await resp2.json();
    expect(result2.hash).toBeDefined();
    expect(result2.prevHash).toBe(result1.hash);
  });

  it('retrieves entries by entityId', async () => {
    const doInstance = new TestAuditLogDO({ storage: new MapStorage() });
    const entityId = 'entity-test';
    await doInstance.fetch(createRequest('POST', '/audit', {
      id: crypto.randomUUID(), tenantId: 't1', action: 'test',
      entityType: 'test', entityId, timestamp: new Date().toISOString(),
    }));

    const resp = await doInstance.fetch(createRequest('GET', `/audit/${entityId}`));
    const result = await resp.json();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].entityId).toBe(entityId);
  });

  it('verifies chain integrity after multiple entries', async () => {
    const doInstance = new TestAuditLogDO({ storage: new MapStorage() });
    for (let i = 0; i < 5; i++) {
      await doInstance.fetch(createRequest('POST', '/audit', {
        id: crypto.randomUUID(), tenantId: 't1', action: `action-${i}`,
        entityType: 'test', entityId: `entity-${i}`, timestamp: new Date().toISOString(),
      }));
    }
    const resp = await doInstance.fetch(createRequest('GET', '/verify'));
    const result = await resp.json();
    expect(result.valid).toBe(true);
    expect(result.count).toBe(5);
  });

  it('detects broken chain', async () => {
    const storage = new MapStorage();
    const doInstance = new TestAuditLogDO({ storage });
    await doInstance.fetch(createRequest('POST', '/audit', {
      id: 'a1', tenantId: 't1', action: 'act1',
      entityType: 't', entityId: 'e1', timestamp: '2026-01-01T00:00:00Z',
    }));
    // Tamper: insert a fake entry with wrong prevHash
    await storage.put('audit:2026-01-01T00:00:01Z:tampered', {
      id: 'tampered', prevHash: 'WRONG_HASH', hash: 'fake',
      entityId: 'e2', timestamp: '2026-01-01T00:00:01Z',
    });
    const resp = await doInstance.fetch(createRequest('GET', '/verify'));
    const result = await resp.json();
    expect(result.valid).toBe(false);
  });
});