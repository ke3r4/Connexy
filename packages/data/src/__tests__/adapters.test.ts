import { describe, it, expect } from 'vitest';
import { D1Adapter, R2Adapter, createDataPlane, PostgresAdapter, QdrantAdapter, MinIOAdapter } from '../adapters.js';

describe('Data Plane Adapters — portability for VPC/on-prem', () => {
  it('D1Adapter implements RelationalDB interface', () => {
    const mockD1 = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ meta: { changes: 0 } }),
        }),
      }),
    };
    const adapter = new D1Adapter(mockD1 as any);
    expect(adapter.prepare('SELECT 1')).toBeDefined();
    expect(adapter.prepare('SELECT 1').bind()).toBeDefined();
  });

  it('PostgresAdapter implements RelationalDB interface', () => {
    const adapter = new PostgresAdapter('postgresql://localhost/connexy');
    expect(adapter.prepare('SELECT 1')).toBeDefined();
    expect(adapter.prepare('SELECT 1').bind()).toBeDefined();
  });

  it('QdrantAdapter implements VectorStore interface', () => {
    const adapter = new QdrantAdapter('http://localhost:6333');
    expect(adapter.upsert).toBeDefined();
    expect(adapter.query).toBeDefined();
  });

  it('MinIOAdapter implements ObjectStorage interface', () => {
    const adapter = new MinIOAdapter('http://localhost:9000', 'key', 'secret');
    expect(adapter.put).toBeDefined();
    expect(adapter.get).toBeDefined();
    expect(adapter.delete).toBeDefined();
    expect(adapter.list).toBeDefined();
  });

  it('createDataPlane throws for cloudflare without required bindings', () => {
    expect(() => createDataPlane({ topology: 'cloudflare' })).toThrow('requires D1');
  });

  it('createDataPlane throws for VPC without required config', () => {
    expect(() => createDataPlane({ topology: 'vpc' })).toThrow('requires postgresConnectionString');
  });

  it('createDataPlane creates cloudflare adapters when bindings provided', () => {
    const mockD1 = { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ meta: { changes: 0 } }) }) }) };
    const mockVectorize = { upsert: async () => {}, query: async () => ({ matches: [] }) };
    const mockR2 = { put: async () => {}, get: async () => null, delete: async () => {}, list: async () => ({ objects: [] }) };
    const plane = createDataPlane({
      topology: 'cloudflare',
      d1: mockD1 as any,
      vectorize: mockVectorize as any,
      r2: mockR2 as any,
    });
    expect(plane.db).toBeDefined();
    expect(plane.vectorStore).toBeDefined();
    expect(plane.objectStorage).toBeDefined();
  });

  it('createDataPlane creates VPC adapters when config provided', () => {
    const plane = createDataPlane({
      topology: 'vpc',
      postgresConnectionString: 'postgresql://localhost/connexy',
      qdrantUrl: 'http://localhost:6333',
      minioEndpoint: 'http://localhost:9000',
      minioAccessKey: 'key',
      minioSecretKey: 'secret',
    });
    expect(plane.db).toBeInstanceOf(PostgresAdapter);
    expect(plane.vectorStore).toBeInstanceOf(QdrantAdapter);
    expect(plane.objectStorage).toBeInstanceOf(MinIOAdapter);
  });
});