import { tokens } from '../theme/tokens';
import type { CSSProperties } from 'react';

export interface GraphNode {
  id: string;
  name: string;
  type: 'fact' | 'dimension' | 'measure' | 'kpi' | 'hierarchy' | 'gap';
  x: number;
  y: number;
  approved?: boolean;
  isGap?: boolean;
}

export interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  approved?: boolean;
}

interface SemanticModelGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
}

const nodeColors: Record<string, string> = {
  fact: tokens.color.accent,
  dimension: tokens.color.accent2,
  measure: tokens.color.warn,
  kpi: tokens.color.ok,
  hierarchy: tokens.color.text1,
  gap: tokens.color.alert,
};

export function SemanticModelGraph({ nodes, edges, onNodeClick }: SemanticModelGraphProps) {
  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '400px',
    backgroundColor: tokens.color.bg0,
    border: `${tokens.border.hairline} ${tokens.color.line}`,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
  };

  const svgStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  };

  return (
    <div style={containerStyle} className="blueprint-grid">
      <svg style={svgStyle} aria-label="Semantic model graph">
        {edges.map(edge => {
          const from = nodes.find(n => n.id === edge.fromId);
          const to = nodes.find(n => n.id === edge.toId);
          if (!from || !to) return null;
          const color = edge.approved ? tokens.color.accent : tokens.color.accent2;
          const dashArray = edge.approved ? 'none' : '4 4';
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          return (
            <g key={edge.id}>
              <line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={color} strokeWidth={1.5} strokeDasharray={dashArray} opacity={0.6}
              />
              <text x={midX} y={midY - 4} fill={tokens.color.text2} fontSize="9" fontFamily={tokens.fontFamily.mono} textAnchor="middle">
                {edge.type}
              </text>
            </g>
          );
        })}
        {nodes.map(node => {
          const color = node.isGap ? tokens.color.alert : (node.approved ? tokens.color.accent : nodeColors[node.type] || tokens.color.accent2);
          const dashArray = node.isGap ? '3 3' : 'none';
          return (
            <g key={node.id} onClick={() => onNodeClick?.(node)} style={{ cursor: 'pointer' }}>
              <rect
                x={node.x - 60} y={node.y - 18} width={120} height={36}
                rx={tokens.radius.sm}
                fill={`${color}12`}
                stroke={color}
                strokeWidth={1}
                strokeDasharray={dashArray}
              />
              <text x={node.x} y={node.y - 2} textAnchor="middle" fill={color} fontSize="11" fontFamily={tokens.fontFamily.mono} fontWeight="600">
                {node.name}
              </text>
              <text x={node.x} y={node.y + 11} textAnchor="middle" fill={tokens.color.text2} fontSize="8" fontFamily={tokens.fontFamily.mono}>
                {node.type}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', bottom: tokens.spacing.sm, left: tokens.spacing.sm, display: 'flex', gap: tokens.spacing.md }}>
        <LegendItem color={tokens.color.accent} label="Approved" />
        <LegendItem color={tokens.color.accent2} label="AI-Proposed" dashed />
        <LegendItem color={tokens.color.alert} label="Gap" dashed />
      </div>
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.xs }}>
      <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '3 3' : 'none'} /></svg>
      <span style={{ fontSize: tokens.fontSize.xs, color: tokens.color.text2, fontFamily: tokens.fontFamily.mono }}>{label}</span>
    </div>
  );
}