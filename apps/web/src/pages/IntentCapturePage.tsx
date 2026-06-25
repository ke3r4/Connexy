import { useState } from 'react';
import { tokens } from '../theme/tokens';
import { Card, Button, Badge } from '../components/ui';
import { api } from '../api/client.js';
import { useAppStore } from '../store/app-store.js';
import type { CSSProperties } from 'react';

const EXAMPLE_INTENTS = [
  'Identify the data needed to connect packaging line 1 to MES for production count, machine state, downtime reason, and batch context',
  'Build the data model for OEE by line, shift, material, and production order',
  'Map SCADA tags to MES production run records for filling line A',
];

export function IntentCapturePage() {
  const navigate = useAppStore((s) => s.navigate);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const [name, setName] = useState('');
  const [intent, setIntent] = useState('');
  const [workflowType, setWorkflowType] = useState<'mes-to-machine' | 'kpi-dashboard'>('mes-to-machine');
  const [description, setDescription] = useState('');
  const [projectPrice, setProjectPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.lg,
    padding: tokens.spacing.xxl,
    maxWidth: '900px',
    margin: '0 auto',
  };

  const textareaStyle: CSSProperties = {
    width: '100%',
    minHeight: '140px',
    padding: tokens.spacing.md,
    backgroundColor: tokens.color.bg0,
    border: `${tokens.border.hairline} ${tokens.color.line}`,
    borderRadius: tokens.radius.md,
    color: tokens.color.text0,
    fontFamily: tokens.fontFamily.sans,
    fontSize: tokens.fontSize.md,
    lineHeight: tokens.lineHeight.relaxed,
    resize: 'vertical',
    outline: 'none',
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: tokens.spacing.md,
    backgroundColor: tokens.color.bg0,
    border: `${tokens.border.hairline} ${tokens.color.line}`,
    borderRadius: tokens.radius.md,
    color: tokens.color.text0,
    fontFamily: tokens.fontFamily.sans,
    fontSize: tokens.fontSize.md,
    outline: 'none',
  };

  const typeButtonStyle = (active: boolean): CSSProperties => ({
    flex: 1,
    padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
    borderRadius: tokens.radius.sm,
    border: `${tokens.border.hairline} ${active ? tokens.color.accent : tokens.color.line}`,
    backgroundColor: active ? `${tokens.color.accent}12` : 'transparent',
    color: active ? tokens.color.accent : tokens.color.text1,
    cursor: 'pointer',
    textAlign: 'left',
    transition: `all ${tokens.transition.fast} ${tokens.transition.ease}`,
  });

  const handleSubmit = async () => {
    if (!name.trim() || !intent.trim()) {
      setError('Project name and intent are required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        workflowType,
        intent: intent.trim(),
        projectPriceUsd: projectPrice ? Number(projectPrice) : undefined,
        modelSpendCapPercentage: 3,
      } as any);
      setCurrentProject(result.project);
      navigate({ name: 'connectors', projectId: result.project.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div>
        <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.sm }}>New Discovery Project</span>
        <h2 style={{ fontSize: tokens.fontSize.xl, fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0 }}>
          Describe your integration goal
        </h2>
        <p style={{ color: tokens.color.text1, marginTop: tokens.spacing.sm, fontSize: tokens.fontSize.md }}>
          Tell Connexy what outcome you need. We'll identify the data, propose mappings, generate a model, and detect gaps.
        </p>
      </div>

      <Card raised>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg }}>
          <div>
            <label className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Project Name</label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Packaging Line A → MES Integration"
            />
          </div>

          <div>
            <label className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.sm }}>Workflow Type</label>
            <div style={{ display: 'flex', gap: tokens.spacing.md }}>
              <button
                style={typeButtonStyle(workflowType === 'mes-to-machine')}
                onClick={() => setWorkflowType('mes-to-machine')}
              >
                <div style={{ fontWeight: tokens.fontWeight.semibold, fontSize: tokens.fontSize.md }}>MES-to-Machine</div>
                <div style={{ fontSize: tokens.fontSize.sm, marginTop: tokens.spacing.xs }}>Connect shop floor to MES</div>
              </button>
              <button
                style={typeButtonStyle(workflowType === 'kpi-dashboard')}
                onClick={() => setWorkflowType('kpi-dashboard')}
              >
                <div style={{ fontWeight: tokens.fontWeight.semibold, fontSize: tokens.fontSize.md }}>KPI Dashboard</div>
                <div style={{ fontSize: tokens.fontSize.sm, marginTop: tokens.spacing.xs }}>Build data model for KPIs</div>
              </button>
            </div>
          </div>

          <div>
            <label className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Intent (plain language)</label>
            <textarea
              style={textareaStyle}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Describe the desired outcome in plain language..."
            />
            <div style={{ display: 'flex', gap: tokens.spacing.sm, marginTop: tokens.spacing.sm, flexWrap: 'wrap' }}>
              <span className="micro-label">Examples:</span>
              {EXAMPLE_INTENTS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setIntent(ex)}
                  style={{
                    fontSize: tokens.fontSize.xs,
                    color: tokens.color.accent,
                    padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
                    borderRadius: tokens.radius.sm,
                    border: `${tokens.border.hairline} ${tokens.color.line}`,
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {ex.substring(0, 60)}...
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Description (optional)</label>
            <input
              style={inputStyle}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context for your team..."
            />
          </div>

          <div>
            <label className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Project Price (USD) — for cost cap enforcement</label>
            <input
              style={inputStyle}
              type="number"
              value={projectPrice}
              onChange={(e) => setProjectPrice(e.target.value)}
              placeholder="e.g. 100.00 (model spend capped at 3%)"
            />
            <div style={{ fontSize: tokens.fontSize.xs, color: tokens.color.text2, marginTop: tokens.spacing.xs }}>
              Connexy caps AI model spend at 3% of project price (BRD KPI). Set the price to enable enforcement.
            </div>
          </div>

          {error && (
            <div style={{
              padding: tokens.spacing.md,
              backgroundColor: `${tokens.color.alert}1A`,
              border: `1px solid ${tokens.color.alert}40`,
              borderRadius: tokens.radius.sm,
              color: tokens.color.alert,
              fontSize: tokens.fontSize.sm,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: tokens.spacing.sm }}>
            <Button variant="ghost" onClick={() => navigate({ name: 'projects' })}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creating...' : 'Create Project →'}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.md, marginBottom: tokens.spacing.md }}>
          <span className="micro-label">How it works</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: tokens.spacing.md }}>
          {[
            { step: '01', title: 'Ingest', desc: 'Read-only metadata from your systems' },
            { step: '02', title: 'Classify & Map', desc: 'AI proposes source-to-target mappings' },
            { step: '03', title: 'Model & Score', desc: 'Semantic model + confidence + gaps' },
            { step: '04', title: 'Review & Export', desc: 'Human approves, export validation package' },
          ].map((s) => (
            <div key={s.step} style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.xs }}>
              <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>{s.step}</span>
              <span style={{ fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0, fontSize: tokens.fontSize.sm }}>{s.title}</span>
              <span style={{ color: tokens.color.text1, fontSize: tokens.fontSize.xs }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}