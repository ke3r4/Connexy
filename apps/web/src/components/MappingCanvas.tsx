import { tokens } from '../theme/tokens';
import type { CSSProperties } from 'react';

export interface MappingLink {
  id: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  confidence: number;
  status: 'proposed' | 'accepted' | 'rejected' | 'modified';
}

interface MappingCanvasProps {
  links: MappingLink[];
  onLinkClick?: (link: MappingLink) => void;
}

export function MappingCanvas({ links, onLinkClick }: MappingCanvasProps) {
  const sources = Array.from(new Map(links.map(l => [l.sourceId, { id: l.sourceId, name: l.sourceName }])).values());
  const targets = Array.from(new Map(links.map(l => [l.targetId, { id: l.targetId, name: l.targetName }])).values());

  const containerStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr 1fr',
    gap: tokens.spacing.md,
    minHeight: '400px',
    position: 'relative',
  };
  const columnStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.sm,
  };
  const columnHeaderStyle: CSSProperties = {
    fontSize: tokens.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: tokens.letterSpacing.wider,
    color: tokens.color.text2,
    fontWeight: tokens.fontWeight.medium,
    paddingBottom: tokens.spacing.sm,
    borderBottom: `${tokens.border.hairline} ${tokens.color.line}`,
  };
  const nodeStyle = (color: string): CSSProperties => ({
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    backgroundColor: tokens.color.bg2,
    border: `${tokens.border.hairline} ${tokens.color.line}`,
    borderLeft: `2px solid ${color}`,
    borderRadius: tokens.radius.sm,
    fontFamily: tokens.fontFamily.mono,
    fontSize: tokens.fontSize.sm,
    color: tokens.color.text0,
    cursor: 'pointer',
  });

  const svgStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  };

  return (
    <div style={containerStyle} className="blueprint-grid">
      <div style={columnStyle}>
        <div style={columnHeaderStyle}>Source Objects</div>
        {sources.map(s => (
          <div key={s.id} style={nodeStyle(tokens.color.accent)}>{s.name}</div>
        ))}
      </div>

      <svg style={svgStyle} aria-hidden="true">
        {links.map((link, i) => {
          const color = link.confidence >= 0.8 ? tokens.color.ok : link.confidence >= 0.6 ? tokens.color.warn : tokens.color.alert;
          const dashArray = link.status === 'accepted' ? 'none' : '4 4';
          const y1 = (i + 0.5) * (400 / Math.max(links.length, 1));
          return (
            <line
              key={link.id}
              x1="33%" y1={y1} x2="66%" y2={y1}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={dashArray}
              opacity={0.7}
            />
          );
        })}
      </svg>

      <div style={columnStyle}>
        <div style={columnHeaderStyle}>Target Objects</div>
        {targets.map(t => (
          <div key={t.id} style={nodeStyle(tokens.color.accent2)} onClick={() => onLinkClick?.(links.find(l => l.targetId === t.id)!)}>{t.name}</div>
        ))}
      </div>
    </div>
  );
}