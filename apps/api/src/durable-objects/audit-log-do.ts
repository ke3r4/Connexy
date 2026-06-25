import { DurableObject } from 'durable-objects';

interface AuditRecord {
  id: string;
  tenantId: string;
  projectId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: string;
  hash: string;
  prevHash?: string;
}

export class AuditLogDO extends DurableObject {
  private async getChainHead(): Promise<string | null> {
    const head = await this.ctx.storage.get<string>('chain:head');
    return head || null;
  }

  private async computeHash(record: AuditRecord): Promise<string> {
    const data = JSON.stringify({
      ...record,
      prevHash: await this.getChainHead(),
    });
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/audit') {
      const body = await request.json() as Partial<AuditRecord>;
      const id = body.id || crypto.randomUUID();
      const timestamp = body.timestamp || new Date().toISOString();
      const prevHash = await this.getChainHead();
      const record: AuditRecord = {
        id,
        tenantId: body.tenantId || '',
        projectId: body.projectId,
        userId: body.userId,
        action: body.action || '',
        entityType: body.entityType || '',
        entityId: body.entityId || '',
        before: body.before,
        after: body.after,
        metadata: body.metadata,
        timestamp,
        prevHash,
        hash: '',
      };
      record.hash = await this.computeHash(record);
      const key = `audit:${timestamp}:${id}`;
      await this.ctx.storage.put(key, record);
      await this.ctx.storage.put('chain:head', record.hash);
      return Response.json({ id, hash: record.hash, prevHash });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/audit/')) {
      const entityId = url.pathname.split('/')[2];
      const entries: AuditRecord[] = [];
      const map = await this.ctx.storage.list<AuditRecord>({ prefix: 'audit:' });
      for (const [, value] of map) {
        if (value.entityId === entityId) {
          entries.push(value);
        }
      }
      entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return Response.json({ entityId, entries });
    }

    if (request.method === 'GET' && url.pathname === '/chain') {
      const head = await this.getChainHead();
      return Response.json({ chainHead: head });
    }

    if (request.method === 'GET' && url.pathname === '/verify') {
      const map = await this.ctx.storage.list<AuditRecord>({ prefix: 'audit:' });
      const entries = Array.from(map.entries()).sort(([, a], [, b]) =>
        a.timestamp.localeCompare(b.timestamp),
      );
      let prevHash: string | null = null;
      let valid = true;
      const report: Array<{ id: string; valid: boolean; reason?: string }> = [];
      for (const [, record] of entries) {
        if (record.prevHash !== prevHash) {
          valid = false;
          report.push({ id: record.id, valid: false, reason: 'Chain broken' });
        } else {
          report.push({ id: record.id, valid: true });
        }
        prevHash = record.hash;
      }
      return Response.json({ valid, count: entries.length, report });
    }

    return new Response('Not found', { status: 404 });
  }
}