import type { D1Database } from '@cloudflare/workers-types';

// Thin adapter interface for relational database access
// Cloudflare topology: D1 (SQLite) | VPC/on-prem: PostgreSQL
export interface RelationalDB {
  prepare(query: string): {
    bind(...params: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results: T[] }>;
      run(): Promise<{ meta: { changes: number } }>;
    };
  };
}

// Thin adapter interface for vector search
// Cloudflare topology: Vectorize | VPC/on-prem: Qdrant
export interface VectorStore {
  upsert(vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>): Promise<void>;
  query(vector: number[], opts: { topK: number; filter: Record<string, unknown>; returnMetadata: string }): Promise<{
    matches?: Array<{ id: string; score: number; metadata?: Record<string, unknown> }>;
  }>;
}

// Thin adapter interface for object storage
// Cloudflare topology: R2 | VPC/on-prem: MinIO (S3-compatible)
export interface ObjectStorage {
  put(key: string, content: string | ReadableStream): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream } | null>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; limit?: number }): Promise<{ keys: string[] }>;
}

// D1 adapter — wraps Cloudflare D1 as RelationalDB
export class D1Adapter implements RelationalDB {
  constructor(private db: D1Database) {}
  prepare(query: string) {
    const prepared = this.db.prepare(query);
    return {
      bind(...params: unknown[]) {
        const bound = prepared.bind(...params);
        return {
          first: <T = unknown>() => bound.first<T>(),
          all: <T = unknown>() => bound.all<T>(),
          run: () => bound.run(),
        };
      },
    };
  }
}

// Vectorize adapter — wraps Cloudflare Vectorize as VectorStore
export class VectorizeAdapter implements VectorStore {
  constructor(private index: VectorizeIndex) {}
  async upsert(vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>) {
    const typedVectors = vectors.map(v => ({
      id: v.id,
      values: v.values,
      metadata: v.metadata as Record<string, VectorizeVectorMetadata>,
    }));
    await this.index.upsert(typedVectors);
  }
  async query(vector: number[], opts: { topK: number; filter: Record<string, unknown>; returnMetadata: string }) {
    return this.index.query(vector, {
      topK: opts.topK,
      filter: opts.filter as Record<string, string | number | boolean>,
      returnMetadata: opts.returnMetadata as 'all' | 'none' | undefined,
    });
  }
}

// R2 adapter — wraps Cloudflare R2 as ObjectStorage
export class R2Adapter implements ObjectStorage {
  constructor(private bucket: R2Bucket) {}
  async put(key: string, content: string | ReadableStream) {
    await this.bucket.put(key, content);
  }
  async get(key: string) {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return { body: obj.body };
  }
  async delete(key: string) {
    await this.bucket.delete(key);
  }
  async list(opts?: { prefix?: string; limit?: number }) {
    const result = await this.bucket.list(opts);
    return { keys: result.objects.map(o => o.key) };
  }
}

// PostgreSQL adapter for VPC/on-prem (uses pg library via nodejs_compat)
// In production, this would use the `pg` package or Hyperdrive
export class PostgresAdapter implements RelationalDB {
  constructor(private connectionString: string) {}
  prepare(query: string) {
    // In production: use pg.Pool to execute the query
    // For now, this is a stub that would be implemented with the pg library
    return {
      bind(...params: unknown[]) {
        return {
          first: async <T = unknown>(): Promise<T | null> => {
            // const result = await pool.query(query, params);
            // return result.rows[0] || null;
            return null;
          },
          all: async <T = unknown>(): Promise<{ results: T[] }> => {
            // const result = await pool.query(query, params);
            // return { results: result.rows };
            return { results: [] };
          },
          run: async () => {
            // await pool.query(query, params);
            return { meta: { changes: 0 } };
          },
        };
      },
    };
  }
}

// Qdrant adapter for VPC/on-prem vector search
export class QdrantAdapter implements VectorStore {
  constructor(private qdrantUrl: string) {}
  async upsert(vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>) {
    // In production: POST to Qdrant REST API
    // await fetch(`${this.qdrantUrl}/collections/connexy/points`, {
    //   method: 'PUT',
    //   body: JSON.stringify({ points: vectors.map(v => ({ id: v.id, vector: v.values, payload: v.metadata })) }),
    // });
  }
  async query(vector: number[], opts: { topK: number; filter: Record<string, unknown>; returnMetadata: string }) {
    // In production: POST to Qdrant search endpoint
    // const result = await fetch(`${this.qdrantUrl}/collections/connexy/points/search`, {
    //   method: 'POST',
    //   body: JSON.stringify({ vector, limit: opts.topK, filter: opts.filter, with_payload: true }),
    // });
    return { matches: [] };
  }
}

// MinIO adapter for VPC/on-prem object storage (S3-compatible)
export class MinIOAdapter implements ObjectStorage {
  constructor(private endpoint: string, private accessKey: string, private secretKey: string) {}
  async put(key: string, content: string | ReadableStream) {
    // In production: use S3 SDK to put object to MinIO
  }
  async get(key: string) {
    // In production: use S3 SDK to get object from MinIO
    return null;
  }
  async delete(key: string) {
    // In production: use S3 SDK to delete object from MinIO
  }
  async list(opts?: { prefix?: string; limit?: number }) {
    // In production: use S3 SDK to list objects from MinIO
    return { keys: [] };
  }
}

// Factory: create the right adapters based on topology
export interface DataPlaneConfig {
  topology: 'cloudflare' | 'vpc' | 'on-prem';
  // Cloudflare
  d1?: D1Database;
  vectorize?: VectorizeIndex;
  r2?: R2Bucket;
  // VPC/on-prem
  postgresConnectionString?: string;
  qdrantUrl?: string;
  minioEndpoint?: string;
  minioAccessKey?: string;
  minioSecretKey?: string;
}

export function createDataPlane(config: DataPlaneConfig): {
  db: RelationalDB;
  vectorStore: VectorStore;
  objectStorage: ObjectStorage;
} {
  if (config.topology === 'cloudflare') {
    if (!config.d1 || !config.vectorize || !config.r2) {
      throw new Error('Cloudflare topology requires D1, Vectorize, and R2 bindings');
    }
    return {
      db: new D1Adapter(config.d1),
      vectorStore: new VectorizeAdapter(config.vectorize),
      objectStorage: new R2Adapter(config.r2),
    };
  }

  // VPC / on-prem
  if (!config.postgresConnectionString || !config.qdrantUrl || !config.minioEndpoint) {
    throw new Error('VPC/on-prem topology requires postgresConnectionString, qdrantUrl, and minioEndpoint');
  }
  return {
    db: new PostgresAdapter(config.postgresConnectionString),
    vectorStore: new QdrantAdapter(config.qdrantUrl),
    objectStorage: new MinIOAdapter(config.minioEndpoint, config.minioAccessKey!, config.minioSecretKey!),
  };
}