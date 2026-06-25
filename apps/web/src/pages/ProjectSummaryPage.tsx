import { useState, useEffect, useCallback } from 'react';
import { tokens } from '../theme/tokens';
import { Card, Button, Badge } from '../components/ui';
import { ConfidenceChip } from '../components/ConfidenceChip.js';
import { api } from '../api/client.js';
import { useAppStore } from '../store/app-store.js';
import type { CSSProperties } from 'react';
import type { Project, Mapping, Gap, SemanticModel, ProjectCost } from '../api/types.js';

export function ProjectSummaryPage({ projectId }: { projectId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const [project, setProject] = useState<Project | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [models, setModels] = useState<SemanticModel[]>([]);
  const [cost, setCost] = useState<ProjectCost | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, mapRes, gapRes, modelRes, costRes] = await Promise.all([
        api.getProject(projectId),
        api.listMappings(projectId).catch(() => ({ mappings: [] })),
        api.listGaps(projectId).catch(() => ({ gaps: [] })),
        api.listModels(projectId).catch(() => ({ models: [] })),
        api.getProjectCost(projectId).catch(() => null),
      ]);
      setProject(proj.project);
      setMappings(mapRes.mappings || []);
      setGaps(gapRes.gaps || []);
      setModels(modelRes.models || []);
      if (costRes) setCost(costRes as unknown as ProjectCost);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const accepted = mappings.filter(m => m.status === 'accepted').length;
  const rejected = mappings.filter(m => m.status === 'rejected').length;
  const pending = mappings.filter(m => m.status === 'proposed').length;
  const openGaps = gaps.filter(g => g.status === 'open').length;
  const resolvedGaps = gaps.filter(g => g.status === 'resolved').length;

  const containerStyle: CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg, padding: tokens.spacing.xl,
  };

  if (loading) return <div style={{ padding: tokens.spacing.xxl, color: tokens.color.text2 }}>Loading...</div>;

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Project Summary</span>
          <h2 style={{ fontSize: tokens.fontSize.xl, fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0 }}>
            {project?.name || 'Project'}
          </h2>
          <div style={{ display: 'flex', gap: tokens.spacing.sm, marginTop: tokens.spacing.sm }}>
            <Badge variant={project?.status === 'approved' || project?.status === 'exported' ? 'ok' : 'warn'}>
              {project?.status}
            </Badge>
            <Badge variant="accent">{project?.workflow_type}</Badge>
          </div>
        </div>
        <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
          <Button variant="secondary" onClick={() => navigate({ name: 'review', projectId })}>Review</Button>
          <Button variant="primary" onClick={() => navigate({ name: 'export', projectId })}>Export →</Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: tokens.spacing.md }}>
        <StatCard label="Mappings" value={mappings.length} color={tokens.color.accent} sublabel={`${accepted} accepted · ${rejected} rejected · ${pending} pending`} />
        <StatCard label="Gaps" value={gaps.length} color={tokens.color.alert} sublabel={`${openGaps} open · ${resolvedGaps} resolved`} />
        <StatCard label="Models" value={models.length} color={tokens.color.accent2} sublabel={`${models.reduce((s, m) => s + (m.entities?.length || 0), 0)} entities`} />
        <StatCard label="Cost" value={cost ? `$${cost.totalCost.toFixed(4)}` : '$0'} color={tokens.color.warn} sublabel={`${cost?.totalCalls || 0} AI calls`} />
      </div>

      {/* Intent */}
      {project?.intent && (
        <Card raised>
          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.sm }}>Original Intent</span>
          <p style={{ color: tokens.color.text1, fontSize: tokens.fontSize.md, lineHeight: tokens.lineHeight.relaxed }}>{project.intent}</p>
        </Card>
      )}

      {/* Mapping Summary */}
      <Card raised>
        <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Mapping Results</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
          {mappings.slice(0, 10).map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              border: `${tokens.border.hairline} ${tokens.color.line}`,
              borderRadius: tokens.radius.sm,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
                <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.text0 }}>
                  {m.source_object_id.substring(0, 12)}...
                </span>
                <span style={{ color: tokens.color.text2 }}>→</span>
                <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.accent2 }}>
                  {m.target_object_id.substring(0, 12)}...
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
                <ConfidenceChip score={m.confidence} />
                <Badge variant={m.status === 'accepted' ? 'ok' : m.status === 'rejected' ? 'alert' : 'warn'}>{m.status}</Badge>
              </div>
            </div>
          ))}
          {mappings.length === 0 && <div style={{ color: tokens.color.text2 }}>No mappings</div>}
        </div>
      </Card>

      {/* Gap Summary */}
      <Card raised>
        <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Gap Analysis</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
          {gaps.slice(0, 5).map(g => (
            <div key={g.id} style={{
              padding: tokens.spacing.md,
              border: `1px dashed ${g.severity === 'critical' || g.severity === 'high' ? tokens.color.alert : tokens.color.warn}40`,
              borderRadius: tokens.radius.sm,
              backgroundColor: `${g.severity === 'critical' ? tokens.color.alert : tokens.color.warn}0A`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: tokens.color.text0, fontSize: tokens.fontSize.sm }}>{g.description}</span>
                <Badge variant={g.status === 'resolved' ? 'ok' : g.status === 'open' ? 'alert' : 'default'}>{g.status}</Badge>
              </div>
            </div>
          ))}
          {gaps.length === 0 && <div style={{ color: tokens.color.text2 }}>No gaps detected</div>}
        </div>
      </Card>

      {/* Cost Breakdown */}
      {cost && (
        <Card raised>
          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Model Cost Breakdown</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
            {Object.entries(cost.byTier || {}).map(([tier, data]) => (
              <div key={tier} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: `${tokens.spacing.sm} 0`, borderBottom: `1px solid ${tokens.color.line}40`,
              }}>
                <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.accent2, textTransform: 'uppercase' }}>
                  {tier} ({data.calls} calls)
                </span>
                <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.warn }}>
                  ${data.cost.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, color, sublabel }: { label: string; value: string | number; color: string; sublabel?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: tokens.spacing.xs,
      padding: tokens.spacing.lg, backgroundColor: tokens.color.bg2,
      border: `${tokens.border.hairline} ${tokens.color.line}`, borderRadius: tokens.radius.md,
      borderTop: `1px solid ${color}30`,
    }}>
      <span style={{ fontSize: tokens.fontSize.xs, textTransform: 'uppercase', letterSpacing: tokens.letterSpacing.wider, color: tokens.color.text2 }}>{label}</span>
      <span style={{ fontSize: tokens.fontSize.xxl, fontWeight: tokens.fontWeight.bold, color, fontFamily: tokens.fontFamily.mono }}>{value}</span>
      {sublabel && <span style={{ fontSize: tokens.fontSize.xs, color: tokens.color.text1 }}>{sublabel}</span>}
    </div>
  );
}