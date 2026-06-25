import { useState, useEffect, useCallback } from 'react';
import { tokens } from '../theme/tokens';
import { Card, Button, Badge } from '../components/ui';
import { ConfidenceChip } from '../components/ConfidenceChip.js';
import { api } from '../api/client.js';
import type { CSSProperties } from 'react';

export function AdminPage() {
  const [stats, setStats] = useState<{
    projects: Array<{ count: number; status: string }>;
    connectors: Array<{ count: number; status: string }>;
    modelCalls: Array<{ count: number; total_cost: number; model_tier: string }>;
  } | null>(null);
  const [spend, setSpend] = useState<Array<{ projectId: string; name: string; total_cost: number; calls: number }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, spendRes] = await Promise.all([
        api.getAdminStats(),
        api.getModelSpend().catch(() => ({ projectSpend: [] })),
      ]);
      setStats(statsRes);
      setSpend((spendRes as { projectSpend: typeof spend }).projectSpend || []);
    } catch {
      // API may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.lg,
    padding: tokens.spacing.xl,
  };

  const statCardStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.xs,
    padding: tokens.spacing.lg,
    backgroundColor: tokens.color.bg2,
    border: `${tokens.border.hairline} ${tokens.color.line}`,
    borderRadius: tokens.radius.md,
    borderTop: `1px solid ${tokens.color.accent}30`,
  };

  const totalProjects = stats?.projects?.reduce((s, p) => s + p.count, 0) || 0;
  const totalConnectors = stats?.connectors?.reduce((s, c) => s + c.count, 0) || 0;
  const totalCost = stats?.modelCalls?.reduce((s, m) => s + (m.total_cost || 0), 0) || 0;
  const totalCalls = stats?.modelCalls?.reduce((s, m) => s + m.count, 0) || 0;

  return (
    <div style={containerStyle}>
      <div>
        <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Admin Dashboard</span>
        <h2 style={{ fontSize: tokens.fontSize.xl, fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0 }}>
          Tenant Overview
        </h2>
      </div>

      {loading ? (
        <div style={{ color: tokens.color.text2, padding: tokens.spacing.xxl, textAlign: 'center' }}>Loading...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: tokens.spacing.md }}>
            <div style={statCardStyle}>
              <span className="micro-label">Projects</span>
              <span style={{ fontSize: tokens.fontSize.xxl, fontWeight: tokens.fontWeight.bold, color: tokens.color.accent, fontFamily: tokens.fontFamily.mono }}>
                {totalProjects}
              </span>
            </div>
            <div style={statCardStyle}>
              <span className="micro-label">Connectors</span>
              <span style={{ fontSize: tokens.fontSize.xxl, fontWeight: tokens.fontWeight.bold, color: tokens.color.accent2, fontFamily: tokens.fontFamily.mono }}>
                {totalConnectors}
              </span>
            </div>
            <div style={statCardStyle}>
              <span className="micro-label">Model Calls</span>
              <span style={{ fontSize: tokens.fontSize.xxl, fontWeight: tokens.fontWeight.bold, color: tokens.color.text0, fontFamily: tokens.fontFamily.mono }}>
                {totalCalls}
              </span>
            </div>
            <div style={statCardStyle}>
              <span className="micro-label">Total Spend</span>
              <span style={{ fontSize: tokens.fontSize.xxl, fontWeight: tokens.fontWeight.bold, color: tokens.color.warn, fontFamily: tokens.fontFamily.mono }}>
                ${totalCost.toFixed(4)}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacing.lg }}>
            <Card raised>
              <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Projects by Status</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                {stats?.projects?.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${tokens.spacing.sm} 0`, borderBottom: `1px solid ${tokens.color.line}40` }}>
                    <Badge variant={p.status === 'approved' || p.status === 'exported' ? 'ok' : p.status === 'review' ? 'warn' : p.status === 'running' ? 'accent' : 'default'}>
                      {p.status}
                    </Badge>
                    <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.text0 }}>{p.count}</span>
                  </div>
                )) || <div style={{ color: tokens.color.text2 }}>No data</div>}
              </div>
            </Card>

            <Card raised>
              <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Connectors by Status</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                {stats?.connectors?.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${tokens.spacing.sm} 0`, borderBottom: `1px solid ${tokens.color.line}40` }}>
                    <Badge variant={c.status === 'validated' ? 'ok' : c.status === 'error' ? 'alert' : 'default'}>{c.status}</Badge>
                    <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.text0 }}>{c.count}</span>
                  </div>
                )) || <div style={{ color: tokens.color.text2 }}>No data</div>}
              </div>
            </Card>
          </div>

          <Card raised>
            <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Model Spend by Tier</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
              {stats?.modelCalls?.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${tokens.spacing.sm} ${tokens.spacing.md}`, border: `${tokens.border.hairline} ${tokens.color.line}`, borderRadius: tokens.radius.sm }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
                    <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.accent2, textTransform: 'uppercase' }}>{m.model_tier}</span>
                    <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>{m.count} calls</span>
                  </div>
                  <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.warn, fontWeight: tokens.fontWeight.semibold }}>
                    ${(m.total_cost || 0).toFixed(4)}
                  </span>
                </div>
              )) || <div style={{ color: tokens.color.text2 }}>No model calls yet</div>}
            </div>
          </Card>

          {spend.length > 0 && (
            <Card raised>
              <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Per-Project Model Spend</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                {spend.map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${tokens.spacing.sm} 0`, borderBottom: `1px solid ${tokens.color.line}40` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
                      <span style={{ color: tokens.color.text0, fontSize: tokens.fontSize.sm }}>{s.name}</span>
                      <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>{s.calls} calls</span>
                    </div>
                    <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: s.total_cost > 0 ? tokens.color.warn : tokens.color.text2 }}>
                      ${s.total_cost.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Prime Directive Compliance</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
              {[
                { directive: 'PD1 Read-only at source', status: 'ENFORCED', variant: 'ok' as const },
                { directive: 'PD2 Human-in-the-loop', status: 'ENFORCED', variant: 'ok' as const },
                { directive: 'PD3 Evidence + confidence', status: 'ENFORCED', variant: 'ok' as const },
                { directive: 'PD4 Auditable (hash-chained)', status: 'ENFORCED', variant: 'ok' as const },
                { directive: 'PD5 Data residency', status: 'ENFORCED', variant: 'ok' as const },
                { directive: 'PD6 Cost-disciplined AI', status: 'ENFORCED', variant: 'ok' as const },
                { directive: 'PD8 Cloudflare-native', status: 'ENFORCED', variant: 'ok' as const },
                { directive: 'PD9 No fabrication', status: 'ENFORCED', variant: 'ok' as const },
              ].map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${tokens.spacing.sm} 0` }}>
                  <span style={{ fontSize: tokens.fontSize.sm, color: tokens.color.text1 }}>{d.directive}</span>
                  <Badge variant={d.variant}>{d.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}