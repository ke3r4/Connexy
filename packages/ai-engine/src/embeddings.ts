import { z } from 'zod';

export interface EmbeddingResult {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

export interface EmbeddingRequest {
  texts: string[];
  projectId: string;
  tenantId: string;
  metadataList?: Record<string, unknown>[];
}

export class EmbeddingPipeline {
  private apiKey = '';
  private endpoint = 'https://api.mistral.ai/v1/embeddings';
  private modelName = 'mistral-embed';
  private aiGatewayId = '';
  private vectorizeIndex?: VectorizeIndex;
  private costPerMToken = 0.12;

  setApiKey(key: string): void { this.apiKey = key; }
  setModel(name: string): void { this.modelName = name; }
  setAiGatewayId(id: string): void { this.aiGatewayId = id; }
  setVectorizeIndex(index: VectorizeIndex): void { this.vectorizeIndex = index; }
  setEndpoint(url: string): void { this.endpoint = url; }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult[]> {
    const url = this.aiGatewayId
      ? `https://gateway.ai.cloudflare.com/v1/${this.aiGatewayId}/mistral/v1/embeddings`
      : this.endpoint;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        input: request.texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error (${response.status}): ${await response.text()}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
      usage: { total_tokens: number };
    };

    const results: EmbeddingResult[] = data.data.map((item, i) => ({
      id: crypto.randomUUID(),
      values: item.embedding,
      metadata: request.metadataList?.[i] || {},
    }));

    return results;
  }

  async embedAndStore(request: EmbeddingRequest): Promise<{ stored: number; costUsd: number }> {
    const results = await this.embed(request);

    if (this.vectorizeIndex) {
      const vectors = results.map((r, i) => ({
        id: r.id,
        values: r.values,
        metadata: {
          ...r.metadata,
          projectId: request.projectId,
          tenantId: request.tenantId,
          text: request.texts[i]?.substring(0, 1000),
        },
      }));
      await this.vectorizeIndex.upsert(vectors);
    }

    const tokenEstimate = request.texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
    const costUsd = (tokenEstimate / 1_000_000) * this.costPerMToken;

    return { stored: results.length, costUsd };
  }

  async semanticSearch(query: string, projectId: string, topK: number = 10): Promise<{ matches: Array<{ id: string; score: number; metadata: Record<string, unknown> }> }> {
    const queryEmbedding = await this.embed({
      texts: [query],
      projectId,
      tenantId: '',
    });

    if (!this.vectorizeIndex) {
      return { matches: [] };
    }

    const results = await this.vectorizeIndex.query(queryEmbedding[0].values, {
      topK,
      filter: { projectId },
      returnMetadata: 'all',
    });

    return {
      matches: results.matches?.map(m => ({
        id: m.id,
        score: m.score,
        metadata: m.metadata || {},
      })) || [],
    };
  }

  async batchEmbed(texts: string[], projectId: string, tenantId: string, batchSize: number = 100): Promise<{ totalStored: number; totalCost: number }> {
    let totalStored = 0;
    let totalCost = 0;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const result = await this.embedAndStore({
        texts: batch,
        projectId,
        tenantId,
      });
      totalStored += result.stored;
      totalCost += result.costUsd;
    }
    return { totalStored, totalCost };
  }
}

export const embeddingPipeline = new EmbeddingPipeline();