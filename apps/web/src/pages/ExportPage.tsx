import { useState, useEffect, useCallback } from 'react';
import { tokens } from '../theme/tokens';
import { Card, Button, Badge } from '../components/ui';
import { api } from '../api/client.js';
import { useAppStore } from '../store/app-store.js';
import type { CSSProperties } from 'react';
import type { ExportPackage, ProjectCost } from '../api/types.js';

export function ExportPage({ projectId }: { projectId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const [packages, setPackages] = useState<ExportPackage[]>([]);
  const [cost, setCost] = useState<ProjectCost | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgResult, costResult] = await Promise.all([
        api.listExports(projectId),
        api.getProjectCost(projectId).catch(() => null),
      ]);
      setPackages(pkgResult.packages || []);
      if (costResult) setCost(costResult as unknown as ProjectCost);
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const generateExport = async (type: string, format: string) => {
    setGenerating(true);
    try {
      await api.createExport({ projectId, type, format });
      setTimeout(load, 1000);
    } finally {
      setGenerating(false);
    }
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.lg,
    padding: tokens.spacing.xl,
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Export & Validation Package</span>
          <h2 style={{ fontSize: tokens.fontSize.xl, fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0 }}>
            Validation-Ready Documentation
          </h2>
        </div>
        <Button variant="ghost" onClick={() => navigate({ name: 'review', projectId })}>← Back to Review</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacing.lg }}>
        <Card raised>
          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Generate Export</span>
          <p style={{ color: tokens.color.text1, fontSize: tokens.fontSize.sm, marginBottom: tokens.spacing.lg }}>
            Produce a validation-ready package containing mappings, semantic model, gaps, and the compliance dossier.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
            <Button variant="primary" onClick={() => generateExport('full', 'json')} disabled={generating}>
              {generating ? 'Generating...' : 'Generate Full Package (JSON)'}
            </Button>
            <Button variant="secondary" onClick={() => generateExport('mapping-spec', 'json')} disabled={generating}>
              Mapping Spec Only
            </Button>
            <Button variant="secondary" onClick={() => generateExport('validation-dossier', 'json')} disabled={generating}>
              Validation Dossier
            </Button>
          </div>
        </Card>

        <Card raised>
          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Model Cost</span>
          {cost ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: tokens.color.text1, fontSize: tokens.fontSize.sm }}>Total Cost</span>
                <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.lg, fontWeight: tokens.fontWeight.semibold, color: tokens.color.accent }}>
                  ${cost.totalCost.toFixed(4)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: tokens.color.text1, fontSize: tokens.fontSize.sm }}>Total Calls</span>
                <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.text0 }}>{cost.totalCalls}</span>
              </div>
              {cost.byTier && Object.entries(cost.byTier).map(([tier, data]) => (
                <div key={tier} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${tokens.spacing.xs} 0`, borderTop: `1px solid ${tokens.color.line}40` }}>
                  <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2, textTransform: 'uppercase' }}>{tier}</span>
                  <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text1 }}>
                    {data.calls} calls · ${data.cost.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: tokens.color.text2, fontStyle: 'italic', fontSize: tokens.fontSize.sm }}>No cost data yet.</div>
          )}
        </Card>
      </div>

      <Card>
        <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Generated Packages</span>
        {loading ? (
          <div style={{ color: tokens.color.text2, padding: tokens.spacing.lg }}>Loading...</div>
        ) : packages.length === 0 ? (
          <div style={{ color: tokens.color.text2, padding: tokens.spacing.lg, fontStyle: 'italic' }}>No packages generated yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
            {packages.map(pkg => (
              <div key={pkg.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: tokens.spacing.md,
                border: `${tokens.border.hairline} ${tokens.color.line}`,
                borderRadius: tokens.radius.sm,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
                  <Badge variant={pkg.status === 'ready' ? 'ok' : pkg.status === 'failed' ? 'alert' : 'warn'}>{pkg.status}</Badge>
                  <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.text0 }}>{pkg.type}</span>
                  <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>.{pkg.format}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
                  <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>
                    {new Date(pkg.generated_at).toLocaleString()}
                  </span>
                  {pkg.status === 'ready' && (
                    <Button variant="secondary" onClick={() => api.downloadExport(pkg.id)}>Download</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}