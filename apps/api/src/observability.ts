import type { Env } from '../env.js';

export interface MetricPoint {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: string;
}

export interface CostMetric {
  projectId: string;
  modelTier: string;
  costUsd: number;
  latencyMs: number;
  success: boolean;
}

export class Observability {
  private metricsBuffer: MetricPoint[] = [];

  recordModelCall(env: Env, metric: CostMetric): void {
    const data = new FormData();
    data.append('metric', 'model_call_count');
    data.append('value', '1');
    data.append('project_id', metric.projectId);
    data.append('model_tier', metric.modelTier);
    data.append('success', String(metric.success));

    this.metricsBuffer.push({
      name: 'connexy.model.call',
      value: 1,
      tags: {
        projectId: metric.projectId,
        modelTier: metric.modelTier,
        success: String(metric.success),
      },
      timestamp: new Date().toISOString(),
    });

    this.metricsBuffer.push({
      name: 'connexy.model.cost',
      value: metric.costUsd,
      tags: {
        projectId: metric.projectId,
        modelTier: metric.modelTier,
      },
      timestamp: new Date().toISOString(),
    });

    this.metricsBuffer.push({
      name: 'connexy.model.latency',
      value: metric.latencyMs,
      tags: {
        projectId: metric.projectId,
        modelTier: metric.modelTier,
      },
      timestamp: new Date().toISOString(),
    });

    env.KV_CONFIG.put(
      `metrics:${metric.projectId}:${Date.now()}`,
      JSON.stringify(this.metricsBuffer.slice(-3)),
    ).catch(() => {});
  }

  recordWorkflowStage(env: Env, projectId: string, stage: string, status: string, durationMs: number): void {
    this.metricsBuffer.push({
      name: 'connexy.workflow.stage.duration',
      value: durationMs,
      tags: { projectId, stage, status },
      timestamp: new Date().toISOString(),
    });
  }

  recordConnectorScan(env: Env, connectorType: string, objectCount: number, durationMs: number): void {
    this.metricsBuffer.push({
      name: 'connexy.connector.scan.duration',
      value: durationMs,
      tags: { connectorType },
      timestamp: new Date().toISOString(),
    });
    this.metricsBuffer.push({
      name: 'connexy.connector.scan.objects',
      value: objectCount,
      tags: { connectorType },
      timestamp: new Date().toISOString(),
    });
  }

  getMetrics(): MetricPoint[] {
    return [...this.metricsBuffer];
  }

  flush(): void {
    this.metricsBuffer = [];
  }

  getDashboardData(projectId?: string): {
    totalModelCalls: number;
    totalCost: number;
    avgLatency: number;
    successRate: number;
    byStage: Record<string, { count: number; duration: number }>;
    byConnector: Record<string, { scans: number; objects: number }>;
  } {
    const modelMetrics = this.metricsBuffer.filter(m => m.name === 'connexy.model.call' && (!projectId || m.tags.projectId === projectId));
    const costMetrics = this.metricsBuffer.filter(m => m.name === 'connexy.model.cost' && (!projectId || m.tags.projectId === projectId));
    const latencyMetrics = this.metricsBuffer.filter(m => m.name === 'connexy.model.latency' && (!projectId || m.tags.projectId === projectId));
    const stageMetrics = this.metricsBuffer.filter(m => m.name === 'connexy.workflow.stage.duration');
    const connectorMetrics = this.metricsBuffer.filter(m => m.name === 'connexy.connector.scan.objects');

    const totalCalls = modelMetrics.length;
    const totalCost = costMetrics.reduce((s, m) => s + m.value, 0);
    const avgLatency = latencyMetrics.length > 0 ? latencyMetrics.reduce((s, m) => s + m.value, 0) / latencyMetrics.length : 0;
    const successCount = modelMetrics.filter(m => m.tags.success === 'true').length;
    const successRate = totalCalls > 0 ? successCount / totalCalls : 0;

    const byStage: Record<string, { count: number; duration: number }> = {};
    for (const m of stageMetrics) {
      const stage = m.tags.stage;
      if (!byStage[stage]) byStage[stage] = { count: 0, duration: 0 };
      byStage[stage].count++;
      byStage[stage].duration += m.value;
    }

    const byConnector: Record<string, { scans: number; objects: number }> = {};
    for (const m of connectorMetrics) {
      const ct = m.tags.connectorType;
      if (!byConnector[ct]) byConnector[ct] = { scans: 0, objects: 0 };
      byConnector[ct].scans++;
      byConnector[ct].objects += m.value;
    }

    return { totalModelCalls: totalCalls, totalCost, avgLatency, successRate, byStage, byConnector };
  }
}

export const observability = new Observability();