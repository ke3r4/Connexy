import type { ModelRequest, ModelResponse, ModelTier } from './types.js';
import { ModelRouterError } from '@connexy/shared';

export interface BatchRequest {
  requests: ModelRequest[];
  parseFn: (raw: string) => unknown;
}

export interface BatchResult {
  responses: ModelResponse[];
  totalCost: number;
  successCount: number;
  failureCount: number;
  // Batch API gives 50% off — tracked here
  discountApplied: boolean;
  originalCost: number;
  discountedCost: number;
}

export class BatchProcessor {
  private batchSize = 50;
  private discountRate = 0.5; // 50% off for batch

  setBatchSize(size: number): void { this.batchSize = size; }
  setDiscountRate(rate: number): void { this.discountRate = rate; }

  chunkRequests(requests: ModelRequest[]): ModelRequest[][] {
    const chunks: ModelRequest[][] = [];
    for (let i = 0; i < requests.length; i += this.batchSize) {
      chunks.push(requests.slice(i, i + this.batchSize));
    }
    return chunks;
  }

  // For non-interactive runs (e.g. re-processing all metadata objects)
  // Mistral batch API gives 50% off. We simulate this by applying the discount
  // to the cost records.
  applyBatchDiscount(cost: number): { original: number; discounted: number; savings: number } {
    const discounted = cost * this.discountRate;
    return { original: cost, discounted, savings: cost - discounted };
  }

  // Check if a set of requests is eligible for batch processing
  // (non-interactive = not user-facing, can tolerate latency)
  isBatchEligible(requests: ModelRequest[]): boolean {
    // Batch is eligible when:
    // 1. More than 5 requests (amortize batch overhead)
    // 2. All from non-interactive stages (classify, embed, score — not plan, map)
    if (requests.length < 5) return false;
    const interactiveStages = ['plan', 'map'];
    return !requests.some(r => interactiveStages.includes(r.stage));
  }

  // Calculate projected savings from batch processing
  projectSavings(requests: ModelRequest[], perCallCostEstimate: number): {
    originalCost: number;
    batchCost: number;
    savings: number;
    savingsPercentage: number;
  } {
    const originalCost = requests.length * perCallCostEstimate;
    const batchCost = originalCost * this.discountRate;
    const savings = originalCost - batchCost;
    return {
      originalCost,
      batchCost,
      savings,
      savingsPercentage: (savings / originalCost) * 100,
    };
  }
}

export const batchProcessor = new BatchProcessor();