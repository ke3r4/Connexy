import { tokens } from '../theme/tokens';
import type { CSSProperties } from 'react';

export interface LineageNode {
  id: string;
  label: string;
  type: 'source' | 'transform' | 'target';
  meta?: string;
}

export interface LineageEdge {
  fromId: string;
  toId: string;
  label?: string;
}

interface LineageExplorerProps {
  nodes: LineageNode[];
  edges: LineageEdge[];
  onNodeClick?: (node: LineageNode) => void;
}

const nodeTypeColors: Record<string, string> = {
  source: tokens.color.accent,
  transform: tokens.color.warn,
  target: tokens.color.ok,
};

const nodeTypeIcons: Record<string, string> = {
  source: 'SRC',
  transform: 'TRX',
  target: 'TGT',
};

export function LineageExplorer({ nodes, edges, onNodeClick }: LineageExplorerProps) {
  const containerStyle: CSSProperties = {
    backgroundColor: tokens.color.bg0,
    border: `${tokens.border.hairline} ${tokens.color.line}`,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
    overflowX: 'auto',
  };

  const flowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing.lg,
    minHeight: '80px',
  };

  const nodeStyle = (node: LineageNode): CSSProperties => {
    const color = nodeTypeColors[node.type];
    return {
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacing.xs,
      padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
      minWidth: '140px',
      border: `${tokens.border.hairline} ${color}40`,
      borderLeft: `3px solid ${color}`,
      borderRadius: tokens.radius.sm,
      backgroundColor: `${color}0A`,
      cursor: 'pointer',
      transition: `background-color ${tokens.transition.fast}`,
    };
  };

  const arrowStyle: CSSProperties = {
    color: tokens.color.text2,
    fontFamily: tokens.fontFamily.mono,
    fontSize: tokens.fontSize.lg,
  };

  const orderedNodes = [...nodes];
  const sourceNodes = orderedNodes.filter(n => n.type === 'source');
  const transformNodes = orderedNodes.filter(n => n.type === 'transform');
  const targetNodes = orderedNodes.filter(n => n.type === 'target');

  return (
    <div style={containerStyle} className="blueprint-grid">
      <div style={flowStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
          <span className="micro-label" style={{ marginBottom: tokens.spacing.xs }}>Source</span>
          {sourceNodes.map(n => (
            <div key={n.id} style={nodeStyle(n)} onClick={() => onNodeClick?.(n)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: nodeTypeColors[n.type], fontWeight: tokens.fontWeight.semibold }}>
                  {nodeTypeIcons[n.type]}
                </span>
              </div>
              <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.text0 }}>{n.label}</span>
              {n.meta && <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>{n.meta}</span>}
            </div>
          ))}
        </div>

        {transformNodes.length > 0 && (
          <>
            <span style={arrowStyle}>→</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
              <span className="micro-label" style={{ marginBottom: tokens.spacing.xs }}>Transform</span>
              {transformNodes.map(n => (
                <div key={n.id} style={nodeStyle(n)} onClick={() => onNodeClick?.(n)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: nodeTypeColors[n.type], fontWeight: tokens.fontWeight.semibold }}>
                      {nodeTypeIcons[n.type]}
                    </span>
                  </div>
                  <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.text0 }}>{n.label}</span>
                  {n.meta && <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>{n.meta}</span>}
                </div>
              ))}
            </div>
          </>
        )}

        <span style={arrowStyle}>→</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
          <span className="micro-label" style={{ marginBottom: tokens.spacing.xs }}>Target</span>
          {targetNodes.map(n => (
            <div key={n.id} style={nodeStyle(n)} onClick={() => onNodeClick?.(n)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: nodeTypeColors[n.type], fontWeight: tokens.fontWeight.semibold }}>
                  {nodeTypeIcons[n.type]}
                </span>
              </div>
              <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.text0 }}>{n.label}</span>
              {n.meta && <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>{n.meta}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}