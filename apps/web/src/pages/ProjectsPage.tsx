import { useState, useEffect, useCallback } from 'react';
import { tokens } from '../theme/tokens';
import { Card, Button, Badge } from '../components/ui';
import { api } from '../api/client.js';
import { useAppStore } from '../store/app-store.js';
import type { CSSProperties } from 'react';
import type { Project } from '../api/types.js';

const statusColors: Record<string, string> = {
  draft: tokens.color.text1,
  running: tokens.color.accent,
  review: tokens.color.warn,
  approved: tokens.color.ok,
  exported: tokens.color.ok,
  archived: tokens.color.text2,
};

export function ProjectsPage() {
  const navigate = useAppStore((s) => s.navigate);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listProjects({ limit: 50 });
      setProjects(result.projects || []);
    } catch {
      // API may not be running in dev
      setProjects([]);
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

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  };

  const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    borderBottom: `${tokens.border.hairline} ${tokens.color.line}`,
    fontSize: tokens.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: tokens.letterSpacing.wider,
    color: tokens.color.text2,
    fontWeight: tokens.fontWeight.medium,
  };

  const tdStyle: CSSProperties = {
    padding: `${tokens.spacing.md} ${tokens.spacing.md}`,
    borderBottom: `1px solid ${tokens.color.line}40`,
    fontSize: tokens.fontSize.sm,
  };

  const openProject = (project: Project) => {
    setCurrentProject(project);
    if (project.status === 'draft') {
      navigate({ name: 'connectors', projectId: project.id });
    } else if (project.status === 'running') {
      navigate({ name: 'discovery', projectId: project.id });
    } else if (project.status === 'review') {
      navigate({ name: 'review', projectId: project.id });
    } else if (project.status === 'approved' || project.status === 'exported') {
      navigate({ name: 'export', projectId: project.id });
    } else {
      navigate({ name: 'project', projectId: project.id });
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Discovery Projects</span>
          <h2 style={{ fontSize: tokens.fontSize.xl, fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0 }}>
            All Projects
          </h2>
        </div>
        <Button variant="primary" onClick={() => navigate({ name: 'project-new' })}>+ New Project</Button>
      </div>

      <Card raised>
        {loading ? (
          <div style={{ padding: tokens.spacing.xxl, textAlign: 'center', color: tokens.color.text2 }}>Loading...</div>
        ) : projects.length === 0 ? (
          <div style={{
            padding: tokens.spacing.xxl,
            textAlign: 'center',
            color: tokens.color.text2,
          }}>
            <p style={{ fontSize: tokens.fontSize.md, marginBottom: tokens.spacing.md }}>No projects yet.</p>
            <p style={{ fontSize: tokens.fontSize.sm }}>Create your first discovery project to get started.</p>
            <div style={{ marginTop: tokens.spacing.lg }}>
              <Button variant="primary" onClick={() => navigate({ name: 'project-new' })}>+ New Project</Button>
            </div>
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} onClick={() => openProject(p)} style={{ cursor: 'pointer', transition: `background-color ${tokens.transition.fast}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${tokens.color.bg2}`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: tokens.fontWeight.medium, color: tokens.color.text0 }}>{p.name}</div>
                    {p.description && <div style={{ color: tokens.color.text2, fontSize: tokens.fontSize.xs, marginTop: tokens.spacing.xs }}>{p.description}</div>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text1 }}>{p.workflow_type}</span>
                  </td>
                  <td style={tdStyle}>
                    <Badge variant={p.status === 'approved' || p.status === 'exported' ? 'ok' : p.status === 'review' ? 'warn' : p.status === 'running' ? 'accent' : 'default'}>
                      {p.status}
                    </Badge>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{ color: statusColors[p.status] || tokens.color.text1, fontSize: tokens.fontSize.xs }}>→</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}