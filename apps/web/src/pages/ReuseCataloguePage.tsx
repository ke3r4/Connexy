import { useState, useEffect, useCallback } from 'react';
import { tokens } from '../theme/tokens';
import { Card, Button, Badge } from '../components/ui';
import { api } from '../api/client.js';
import type { CSSProperties } from 'react';

interface ReuseArtifact {
  id: string;
  tenant_id: string;
  scope: 'project' | 'site' | 'enterprise';
  artifact_type: string;
  artifact_id: string;
  name: string;
  source_project_id?: string;
  promoted_by: string;
  promoted_at: string;
}

export function ReuseCataloguePage() {
  const [artifacts, setArtifacts] = useState<ReuseArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listReuseArtifacts(scopeFilter);
      setArtifacts(result.artifacts || []);
    } catch {
      setArtifacts([]);
    } finally {
      setLoading(false);
    }
  }, [scopeFilter]);

  useEffect(() => { load(); }, [load]);

  const containerStyle: CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg, padding: tokens.spacing.xl,
  };

  const scopeColors: Record<string, string> = {
    enterprise: tokens.color.accent,
    site: tokens.color.accent2,
    project: tokens.color.text1,
  };

  return (
    <div style={containerStyle}>
      <div>
        <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Reuse Catalogue</span>
        <h2 style={{ fontSize: tokens.fontSize.xl, fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0 }}>
          Promoted Artifacts
        </h2>
        <p style={{ color: tokens.color.text1, marginTop: tokens.spacing.xs, fontSize: tokens.fontSize.sm }}>
          Approved mappings, models, and hierarchies promoted to site or enterprise scope for cross-project reuse.
        </p>
      </div>

      <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
        {['all', 'enterprise', 'site', 'project'].map(s => (
          <button
            key={s}
            onClick={() => setScopeFilter(s)}
            style={{
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              borderRadius: tokens.radius.sm,
              border: `${tokens.border.hairline} ${scopeFilter === s ? tokens.color.accent : tokens.color.line}`,
              backgroundColor: scopeFilter === s ? `${tokens.color.accent}12` : 'transparent',
              color: scopeFilter === s ? tokens.color.accent : tokens.color.text1,
              cursor: 'pointer',
              fontSize: tokens.fontSize.sm,
              textTransform: 'uppercase',
              letterSpacing: tokens.letterSpacing.wide,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <Card raised>
        {loading ? (
          <div style={{ color: tokens.color.text2, padding: tokens.spacing.xxl, textAlign: 'center' }}>Loading...</div>
        ) : artifacts.length === 0 ? (
          <div style={{ padding: tokens.spacing.xxl, textAlign: 'center', color: tokens.color.text2 }}>
            <p style={{ fontSize: tokens.fontSize.md, marginBottom: tokens.spacing.md }}>No promoted artifacts yet.</p>
            <p style={{ fontSize: tokens.fontSize.sm }}>Complete a project review and promote approved artifacts to reuse them across projects.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
            {artifacts.map(a => (
              <div key={a.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: tokens.spacing.md, border: `${tokens.border.hairline} ${tokens.color.line}`,
                borderRadius: tokens.radius.sm, borderLeft: `3px solid ${scopeColors[a.scope] || tokens.color.text1}`,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.xs }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
                    <span style={{ fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0, fontSize: tokens.fontSize.sm }}>{a.name}</span>
                    <Badge variant={a.scope === 'enterprise' ? 'accent' : a.scope === 'site' ? 'default' : 'default'}>{a.scope}</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: tokens.spacing.md }}>
                    <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>{a.artifact_type}</span>
                    <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>{new Date(a.promoted_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button variant="ghost">Reuse</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}