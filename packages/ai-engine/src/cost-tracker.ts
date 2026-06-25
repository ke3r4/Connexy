import type { CostRecord } from './types.js';

export interface CostTracker {
  record(cost: CostRecord): Promise<void>;
  getProjectSpend(projectId: string): Promise<{ totalCost: number; calls: number; byTier: Record<string, { cost: number; calls: number }> }>;
  getTenantSpend(tenantId: string): Promise<{ totalCost: number; projects: Record<string, number> }>;
}

export class InMemoryCostTracker implements CostTracker {
  private records: CostRecord[] = [];

  async record(cost: CostRecord): Promise<void> {
    this.records.push(cost);
  }

  async getProjectSpend(projectId: string) {
    const projectRecords = this.records.filter(r => r.projectId === projectId);
    const totalCost = projectRecords.reduce((sum, r) => sum + r.costUsd, 0);
    const byTier: Record<string, { cost: number; calls: number }> = {};
    for (const r of projectRecords) {
      if (!byTier[r.modelTier]) byTier[r.modelTier] = { cost: 0, calls: 0 };
      byTier[r.modelTier].cost += r.costUsd;
      byTier[r.modelTier].calls++;
    }
    return { totalCost, calls: projectRecords.length, byTier };
  }

  async getTenantSpend(_tenantId: string) {
    return { totalCost: 0, projects: {} };
  }
}